using System.Security.Claims;
using Chatter.API.Hubs;
using Chatter.Application.DTOs.Chat;
using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Chatter.API.Controllers;

[Authorize]
public class ChatController : BaseApiController
{
    private readonly IChatService _chatService;
    private readonly IHubContext<ChatHub> _hubContext;

    public ChatController(IChatService chatService, IHubContext<ChatHub> hubContext)
    {
        _chatService = chatService;
        _hubContext = hubContext;
    }

    // 1. Sohbet ID'si Alma veya Oluşturma
    [HttpPost("conversation/{targetUserId}")]
    public async Task<IActionResult> GetOrCreateConversation(Guid targetUserId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.CreatePrivateConversationAsync(currentUserId, targetUserId);
        return HandleResult(result);
    }

    // 2. Kullanıcının Sohbetlerini Listeleme
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.GetUserConversationsAsync(currentUserId);
        return HandleResult(result);
    }

    // 3. Sohbet Geçmişini Getirme
    [HttpGet("messages/{conversationId}")]
    public async Task<IActionResult> GetMessages(Guid conversationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.GetConversationMessagesAsync(conversationId, page, pageSize, currentUserId);
        return HandleResult(result);
    }

    // 4. Mesaj Gönderme
    [HttpPost("send")]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.SendMessageAsync(request, currentUserId);
        return HandleResult(result);
    }

    // 5. OKUNDU İŞARETLEME
    [HttpPost("mark-read/{senderId}")]
    public async Task<IActionResult> MarkAsRead(Guid senderId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        // A) Önce sohbet ID'sini bul
        var convResult = await _chatService.CreatePrivateConversationAsync(currentUserId, senderId);
        
        if (!convResult.IsSuccess) 
            return HandleResult(convResult);

        // B) Mesajları "Okundu" yap
        var readResult = await _chatService.MarkMessagesAsReadAsync(convResult.Value, currentUserId);

        if (readResult.IsSuccess)
        {
            // C) SignalR ile karşı tarafa bildirim yolla
            await _hubContext.Clients.User(senderId.ToString()).SendAsync("MessagesRead", currentUserId);
        }

        return HandleResult(readResult);
    }

    // 6. Son Mesajı Getir (Sınıfın İÇİNE ALINDI)
    [HttpGet("last-message/{conversationId}")]
    public async Task<IActionResult> GetLastMessage(Guid conversationId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.GetLastMessageAsync(conversationId);
        
        // Backend'de message null ise Success(null) dönüyorduk.
        // BaseApiController'daki HandleResult muhtemelen null gelince 404 dönüyor.
        // Frontend bunu handle ettiği için sorun yok.
        return HandleResult(result);
    }

    // 7. Mesaj Düzenleme
    [HttpPut("messages/{messageId}")]
    public async Task<IActionResult> EditMessage(Guid messageId, [FromBody] UpdateMessageRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.EditMessageAsync(messageId, currentUserId, request.Content);
        return HandleResult(result);
    }

    // 8. Mesaj Arama
    [HttpGet("conversations/{conversationId}/messages/search")]
    public async Task<IActionResult> SearchMessages(Guid conversationId, [FromQuery] string query)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(query))
            return BadRequest(new { error = "Arama sorgusu boş olamaz." });

        var result = await _chatService.SearchMessagesAsync(conversationId, currentUserId, query);
        return HandleResult(result);
    }

    // 9. Reaksiyon Ekleme
    [HttpPost("messages/{messageId}/reactions")]
    public async Task<IActionResult> AddReaction(Guid messageId, [FromBody] AddReactionRequest request)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.AddReactionAsync(messageId, currentUserId, request.Emoji);
        return HandleResult(result);
    }

    // 10. Reaksiyon Kaldırma
    [HttpDelete("messages/{messageId}/reactions/{emoji}")]
    public async Task<IActionResult> RemoveReaction(Guid messageId, string emoji)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        var result = await _chatService.RemoveReactionAsync(messageId, currentUserId, emoji);
        return HandleResult(result);
    }

    // --- Yardımcı Metot ---
    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var claimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        return !string.IsNullOrEmpty(claimValue) && Guid.TryParse(claimValue, out userId);
    }
}