using Chatter.Application.DTOs.Chat;
using Chatter.Application.Services;
using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace Chatter.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;
    private readonly IUnitOfWork _unitOfWork;

    public ChatHub(IChatService chatService, IUnitOfWork unitOfWork)
    {
        _chatService = chatService;
        _unitOfWork = unitOfWork;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
        {
            // Add connection to DB
            var connection = new UserConnection
            {
                UserId = userId,
                ConnectionId = Context.ConnectionId,
                UserAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"],
                IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString(),
                ConnectedAt = DateTime.UtcNow,
                IsActive = true
            };

            await _unitOfWork.UserConnections.AddAsync(connection);
            await _unitOfWork.SaveChangesAsync();

            // Notify others that user is online (optional, can be implemented later)
            // await Clients.Others.SendAsync("UserConnected", userId);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (userId != null)
        {
            await _unitOfWork.UserConnections.DisconnectAsync(Context.ConnectionId);
            await _unitOfWork.SaveChangesAsync();
            
            // Notify others that user is offline
            // await Clients.Others.SendAsync("UserDisconnected", userId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(SendMessageRequest request)
    {
        var userId = Context.UserIdentifier;
        if (userId == null) return;

        var messageDto = await _chatService.SendMessageAsync(request, userId);

        // Send to receiver
        if (!string.IsNullOrEmpty(request.ReceiverId))
        {
            await Clients.User(request.ReceiverId).SendAsync("ReceiveMessage", messageDto);
        }
        
        // Send to sender (to sync other devices and confirm to current device)
        // We use Clients.User(userId) to send to all connections of the sender
        await Clients.User(userId).SendAsync("ReceiveMessage", messageDto);
    }
}
