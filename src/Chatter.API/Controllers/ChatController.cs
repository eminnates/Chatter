using System.Security.Claims;
using Chatter.API.Hubs;
using Chatter.Application.DTOs.Chat;
using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace Chatter.API.Controllers;

[Authorize]
public class ChatController : BaseApiController // ControllerBase yerine BaseApiController
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

        // Servis Result<Guid> dönüyor
        var result = await _chatService.CreatePrivateConversationAsync(currentUserId, targetUserId);
        
        // HandleResult: Başarılıysa Ok(Guid), başarısızsa BadRequest(Error) döner
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
    // Frontend'den gelen string ID'yi Guid olarak alıyoruz (ASP.NET otomatik çevirir)
    [HttpPost("mark-read/{senderId}")]
    public async Task<IActionResult> MarkAsRead(Guid senderId)
    {
        if (!TryGetCurrentUserId(out var currentUserId))
            return Unauthorized();

        // A) Önce bu iki kişi arasındaki sohbet ID'sini bul
        // Not: CreatePrivateConversationAsync mevcut sohbet varsa ID'sini döner
        var convResult = await _chatService.CreatePrivateConversationAsync(currentUserId, senderId);
        
        if (!convResult.IsSuccess) 
            return HandleResult(convResult); // Hata varsa dön

        // B) Mesajları veritabanında "Okundu" yap
        var readResult = await _chatService.MarkMessagesAsReadAsync(convResult.Value, currentUserId);

        if (readResult.IsSuccess)
        {
            // C) SignalR ile karşı tarafa (mesajı atana) "Görüldü" haberi yolla
            // SignalR user ID'leri genelde string tutar, o yüzden ToString()
            await _hubContext.Clients.User(senderId.ToString()).SendAsync("MessagesRead", currentUserId);
        }

        return HandleResult(readResult);
    }

    // --- Yardımcı Metot ---
    // Bunu BaseApiController içine de taşıyabilirsin, burada private olarak da kalabilir.
    private bool TryGetCurrentUserId(out Guid userId)
    {
        userId = Guid.Empty;
        var claimValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        return !string.IsNullOrEmpty(claimValue) && Guid.TryParse(claimValue, out userId);
    }
}