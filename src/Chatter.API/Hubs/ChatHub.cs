using Chatter.Application.DTOs.Chat;
using Chatter.Application.Services;
using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

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
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString))
        {
            Console.WriteLine($"⚠️ Connection attempt without user identifier: {Context.ConnectionId}");
            await base.OnConnectedAsync();
            return;
        }
        
        if (Guid.TryParse(userIdString, out var userId))
        {
            try
            {
                var connection = new UserConnection
                {
                    UserId = userId, 
                    ConnectionId = Context.ConnectionId,
                    UserAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString(),
                    IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString(),
                    ConnectedAt = DateTime.UtcNow,
                    IsActive = true
                };

                await _unitOfWork.UserConnections.AddAsync(connection);
            
            // Kullanıcı durumunu güncelle
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user != null)
            {
                user.SetOnlineStatus(true);
            }

                // Tek bir SaveChanges ile atomik işlem yapıyoruz
                await _unitOfWork.SaveChangesAsync();
                
                // Diğer kullanıcılara bu kullanıcının online olduğunu bildir
                await Clients.AllExcept(Context.ConnectionId).SendAsync("UserOnline", userId);
                
                Console.WriteLine($"✅ User {userId} connected: {Context.ConnectionId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error in OnConnectedAsync for user {userId}: {ex.Message}");
                throw;
            }
        }
        else
        {
            Console.WriteLine($"⚠️ Invalid user ID format: {userIdString}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userIdString = Context.UserIdentifier;
        
        if (exception != null)
        {
            Console.WriteLine($"⚠️ Connection closed with exception for {userIdString}: {exception.Message}");
        }
        
        if (string.IsNullOrEmpty(userIdString))
        {
            await base.OnDisconnectedAsync(exception);
            return;
        }
        
        if (Guid.TryParse(userIdString, out var userId))
        {
            try
            {
                // Interface'indeki isme göre güncelledik: DisconnectAsync
                await _unitOfWork.UserConnections.DisconnectAsync(Context.ConnectionId);
            
            // DÜZELTME: Interface'indeki metod ismi GetUserActiveConnectionsAsync
            var activeConnections = await _unitOfWork.UserConnections.GetUserActiveConnectionsAsync(userId);
            
            if (activeConnections == null || !activeConnections.Any())
            {
                var user = await _unitOfWork.Users.GetByIdAsync(userId);
                if (user != null)
                {
                    user.SetOnlineStatus(false);
                    user.LastSeenAt = DateTime.UtcNow;
                }
                
                    await _unitOfWork.SaveChangesAsync();
                    await Clients.All.SendAsync("UserOffline", userId);
                    Console.WriteLine($"👋 User {userId} went offline");
                }
                else
                {
                    await _unitOfWork.SaveChangesAsync();
                    Console.WriteLine($"🔄 User {userId} still has active connections");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error in OnDisconnectedAsync for user {userId}: {ex.Message}");
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(SendMessageRequest request)
    {
        var senderIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(senderIdString) || !Guid.TryParse(senderIdString, out var senderId)) 
        {
            Console.WriteLine($"❌ Invalid sender ID in SendMessage: {senderIdString}");
            await Clients.Caller.SendAsync("ErrorMessage", "Geçersiz kullanıcı kimliği.");
            return;
        }
        
        if (request == null || (!request.ReceiverId.HasValue && request.ConversationId == null))
        {
            Console.WriteLine($"❌ Invalid message request from {senderId}");
            await Clients.Caller.SendAsync("ErrorMessage", "Geçersiz mesaj isteği.");
            return;
        }

        var result = await _chatService.SendMessageAsync(request, senderId);

        if (result.IsSuccess)
        {
            var messageDto = result.Value;

            // Alıcıya gönder
            if (request.ReceiverId.HasValue)
            {
                await Clients.User(request.ReceiverId.Value.ToString()).SendAsync("ReceiveMessage", messageDto);
                Console.WriteLine($"📤 Message sent from {senderId} to {request.ReceiverId.Value}");
            }
            
            // Gönderene gönder (Diğer açık sekmeleri/cihazları varsa senkronize olur)
            await Clients.User(senderIdString!).SendAsync("ReceiveMessage", messageDto);
        }
        else
        {
            Console.WriteLine($"❌ Message send failed from {senderId}: {result.Error?.Message}");
            await Clients.Caller.SendAsync("ErrorMessage", result.Error?.Message ?? "Mesaj gönderileme hatası.");
        }
    }
    public async Task NotifyTyping(Guid receiverId)
    {
        var senderId = Context.UserIdentifier;
        
        if (!string.IsNullOrEmpty(senderId))
        {
            // SignalR .User() metodu string istediği için burada çeviriyoruz
            await Clients.User(receiverId.ToString()).SendAsync("UserTyping", senderId);
        }
    }
     public async Task NotifyStoppedTyping(Guid receiverId)
    {
        var senderId = Context.UserIdentifier;
        
        if (!string.IsNullOrEmpty(senderId))
        {
            await Clients.User(receiverId.ToString()).SendAsync("UserStoppedTyping", senderId);
        }
    }
}