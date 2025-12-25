using Chatter.Application.DTOs.Chat;
using Chatter.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Chatter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var conversations = await _chatService.GetUserConversationsAsync(userId!);
        return Ok(new { success = true, data = conversations });
    }

    [HttpGet("messages/{conversationId}")]
    public async Task<IActionResult> GetMessages(Guid conversationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var messages = await _chatService.GetConversationMessagesAsync(conversationId, page, pageSize, userId!);
        return Ok(new { success = true, data = messages });
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var message = await _chatService.SendMessageAsync(request, userId!);
        return Ok(new { success = true, data = message });
    }

    [HttpPost("read/{conversationId}")]
    public async Task<IActionResult> MarkAsRead(Guid conversationId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        await _chatService.MarkMessagesAsReadAsync(conversationId, userId!);
        return Ok(new { success = true, message = "Mesajlar okundu olarak işaretlendi." });
    }
}
