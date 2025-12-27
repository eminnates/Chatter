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
        
        // UserId'yi Guid'e çeviriyoruz
        if (!string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out var userId))
        {
            var connection = new UserConnection
            {
                // DÜZELTME: userId.ToString() değil, direkt userId (Çünkü Entity'de Guid)
                UserId = userId, 
                ConnectionId = Context.ConnectionId,
                UserAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString(),
                IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString(),
                ConnectedAt = DateTime.UtcNow,
                IsActive = true
            };

            await _unitOfWork.UserConnections.AddAsync(connection);
            await _unitOfWork.SaveChangesAsync();
            
            // Kullanıcıyı online yap (Repository Guid bekliyor, bu doğru)
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user != null)
            {
                user.SetOnlineStatus(true);
                await _unitOfWork.SaveChangesAsync();
                await Clients.All.SendAsync("UserOnline", userId);
            }

            // (Opsiyonel) Kullanıcıyı kendi User ID'si ile bir gruba ekleyebilirsin
            // await Groups.AddToGroupAsync(Context.ConnectionId, userIdString);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userIdString = Context.UserIdentifier;
        
        if (!string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out var userId))
        {
            await _unitOfWork.UserConnections.DisconnectAsync(Context.ConnectionId);
            
            // Kullanıcıyı offline yap
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user != null)
            {
                user.SetOnlineStatus(false);
                user.LastSeenAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync();
                await Clients.All.SendAsync("UserOffline", userId);
            }
            
            await _unitOfWork.SaveChangesAsync();
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(SendMessageRequest request)
    {
        var userIdString = Context.UserIdentifier;
        
        // 1. Sender ID'yi Guid'e çevir
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var senderId)) 
        {
            await Clients.Caller.SendAsync("ErrorMessage", "Oturum bilgisi geçersiz.");
            return;
        }

        // 2. Mesajı Service üzerinden kaydet
        var result = await _chatService.SendMessageAsync(request, senderId);

        if (result.IsSuccess)
        {
            var messageDto = result.Value;

            // 3. Alıcıya Mesajı Gönder
            // SignalR'ın Clients.User metodu STRING ID bekler. Bu yüzden burada ToString() kullanmak DOĞRUDUR.
            if (request.ReceiverId.HasValue)
            {
                await Clients.User(request.ReceiverId.Value.ToString()).SendAsync("ReceiveMessage", messageDto);
            }
            // Eğer ReceiverId yoksa ama ConversationId varsa, o conversation'daki diğer kişileri bulup atmak gerekir.
            // Şimdilik sadece gönderene ve eğer receiverId varsa ona gidiyor.
            
            // 4. Gönderene Mesajı Geri Gönder (UI'da anında gözükmesi için)
            await Clients.User(senderId.ToString()).SendAsync("ReceiveMessage", messageDto);
        }
        else
        {
            await Clients.Caller.SendAsync("ErrorMessage", result.Error?.Message ?? "Mesaj gönderilemedi.");
        }
    }
}