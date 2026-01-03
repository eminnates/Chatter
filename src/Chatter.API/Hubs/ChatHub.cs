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
    private readonly ICallService _callService;
    private readonly IUnitOfWork _unitOfWork;

    public ChatHub(IChatService chatService, ICallService callService, IUnitOfWork unitOfWork)
    {
        _chatService = chatService;
        _callService = callService;
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
                
                    // Force end any active calls when user goes completely offline
                    var endedCalls = await _callService.ForceEndUserCallsAsync(userId);
                    if (endedCalls.IsSuccess && endedCalls.Value > 0)
                    {
                        Console.WriteLine($"🔴 Force ended {endedCalls.Value} call(s) for offline user {userId}");
                        // Notify other participants that call ended
                        await Clients.All.SendAsync("CallEnded", new { userId, reason = "UserDisconnected" });
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

    /// <summary>
    /// Manually set user offline (e.g., when app goes to background on mobile)
    /// </summary>
    public async Task SetUserOffline()
    {
        var userIdString = Context.UserIdentifier;
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
            return;

        try
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user != null)
            {
                user.SetOnlineStatus(false);
                user.LastSeenAt = DateTime.UtcNow;
                await _unitOfWork.SaveChangesAsync();
                
                // End any active calls
                var endedCalls = await _callService.ForceEndUserCallsAsync(userId);
                if (endedCalls.IsSuccess && endedCalls.Value > 0)
                {
                    Console.WriteLine($"🔴 Force ended {endedCalls.Value} call(s) for backgrounded user {userId}");
                    await Clients.All.SendAsync("CallEnded", new { userId, reason = "UserBackgrounded" });
                }
                
                await Clients.AllExcept(Context.ConnectionId).SendAsync("UserOffline", userId);
                Console.WriteLine($"📱 User {userId} manually set offline (app backgrounded)");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in SetUserOffline for user {userId}: {ex.Message}");
        }
    }

    /// <summary>
    /// Manually set user online (e.g., when app comes to foreground on mobile)
    /// </summary>
    public async Task SetUserOnline()
    {
        var userIdString = Context.UserIdentifier;
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
            return;

        try
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            if (user != null)
            {
                user.SetOnlineStatus(true);
                await _unitOfWork.SaveChangesAsync();
                
                await Clients.AllExcept(Context.ConnectionId).SendAsync("UserOnline", userId);
                Console.WriteLine($"📱 User {userId} manually set online (app foregrounded)");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error in SetUserOnline for user {userId}: {ex.Message}");
        }
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

    // ==================== CALL METHODS ====================

    public async Task InitiateCall(Guid receiverId, int callType)
    {
        var initiatorIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(initiatorIdString) || !Guid.TryParse(initiatorIdString, out var initiatorId))
        {
            Console.WriteLine($"❌ Invalid initiator ID in InitiateCall: {initiatorIdString}");
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var request = new InitiateCallRequest
        {
            ReceiverId = receiverId,
            Type = (Domain.Enums.CallType)callType
        };

        var result = await _callService.InitiateCallAsync(request, initiatorId);

        if (result.IsSuccess)
        {
            var callDto = result.Value;
            
            // Notify receiver about incoming call
            await Clients.User(receiverId.ToString()).SendAsync("IncomingCall", callDto);
            
            // Confirm to initiator
            await Clients.Caller.SendAsync("CallInitiated", callDto);
            
            Console.WriteLine($"📞 Call initiated from {initiatorId} to {receiverId} (Type: {callType})");
        }
        else
        {
            Console.WriteLine($"❌ Call initiation failed: {result.Error?.Message}");
            await Clients.Caller.SendAsync("CallError", result.Error?.Message ?? "Failed to initiate call.");
        }
    }

    public async Task AcceptCall(Guid callId)
    {
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var result = await _callService.AcceptCallAsync(callId, userId);

        if (result.IsSuccess)
        {
            var callDto = result.Value;
            
            // Notify all participants that call was accepted
            foreach (var participantId in callDto.ParticipantIds)
            {
                await Clients.User(participantId.ToString()).SendAsync("CallAccepted", callDto);
            }
            
            Console.WriteLine($"✅ Call {callId} accepted by {userId}");
        }
        else
        {
            Console.WriteLine($"❌ Call accept failed: {result.Error?.Message}");
            await Clients.Caller.SendAsync("CallError", result.Error?.Message ?? "Failed to accept call.");
        }
    }

    public async Task DeclineCall(Guid callId)
    {
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var result = await _callService.DeclineCallAsync(callId, userId);

        if (result.IsSuccess)
        {
            var callDto = result.Value;
            
            // Notify all participants that call was declined
            foreach (var participantId in callDto.ParticipantIds)
            {
                await Clients.User(participantId.ToString()).SendAsync("CallDeclined", callDto);
            }
            
            // Create a system message for declined call
            var callTypeText = callDto.Type == Domain.Enums.CallType.Video ? "Video call" : "Voice call";
            var declinerName = callDto.InitiatorId == userId ? "You" : "User";
            
            var systemMessage = new Domain.Entities.Message
            {
                ConversationId = callDto.ConversationId,
                SenderId = userId,
                Content = $"{callTypeText} declined",
                Type = Domain.Enums.MessageType.System,
                Status = Domain.Enums.MessageStatus.Sent,
                SentAt = DateTime.UtcNow
            };
            
            await _unitOfWork.Messages.AddAsync(systemMessage);
            await _unitOfWork.SaveChangesAsync();
            
            // Broadcast the declined message to all participants
            var messageDto = new Application.DTOs.Chat.MessageDto
            {
                Id = systemMessage.Id,
                ConversationId = systemMessage.ConversationId,
                SenderId = systemMessage.SenderId,
                SenderName = "System",
                Content = systemMessage.Content,
                Type = systemMessage.Type.ToString(),
                SentAt = systemMessage.SentAt,
                IsRead = false
            };
            
            foreach (var participantId in callDto.ParticipantIds)
            {
                await Clients.User(participantId.ToString()).SendAsync("ReceiveMessage", messageDto);
            }
            
            Console.WriteLine($"❌ Call {callId} declined by {userId}");
        }
        else
        {
            Console.WriteLine($"❌ Call decline failed: {result.Error?.Message}");
            await Clients.Caller.SendAsync("CallError", result.Error?.Message ?? "Failed to decline call.");
        }
    }

    public async Task EndCall(Guid callId)
    {
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var result = await _callService.EndCallAsync(callId, userId);

        if (result.IsSuccess)
        {
            var callDto = result.Value;
            
            // Notify all participants that call ended
            foreach (var participantId in callDto.ParticipantIds)
            {
                await Clients.User(participantId.ToString()).SendAsync("CallEnded", callDto);
            }
            
            // Create a system message for call history
            if (callDto.Status == Domain.Enums.CallStatus.Ended && callDto.DurationInSeconds.HasValue)
            {
                var callTypeText = callDto.Type == Domain.Enums.CallType.Video ? "Video call" : "Voice call";
                var durationMinutes = callDto.DurationInSeconds.Value / 60;
                var durationSeconds = callDto.DurationInSeconds.Value % 60;
                var durationText = durationMinutes > 0 
                    ? $"{durationMinutes}m {durationSeconds}s" 
                    : $"{durationSeconds}s";
                
                var systemMessage = new Domain.Entities.Message
                {
                    ConversationId = callDto.ConversationId,
                    SenderId = userId,
                    Content = $"{callTypeText} • {durationText}",
                    Type = Domain.Enums.MessageType.System,
                    Status = Domain.Enums.MessageStatus.Sent,
                    SentAt = DateTime.UtcNow
                };
                
                await _unitOfWork.Messages.AddAsync(systemMessage);
                await _unitOfWork.SaveChangesAsync();
                
                // Broadcast the call history message to all participants
                var messageDto = new Application.DTOs.Chat.MessageDto
                {
                    Id = systemMessage.Id,
                    ConversationId = systemMessage.ConversationId,
                    SenderId = systemMessage.SenderId,
                    SenderName = "System",
                    Content = systemMessage.Content,
                    Type = systemMessage.Type.ToString(),
                    SentAt = systemMessage.SentAt,
                    IsRead = false
                };
                
                foreach (var participantId in callDto.ParticipantIds)
                {
                    await Clients.User(participantId.ToString()).SendAsync("ReceiveMessage", messageDto);
                }
            }
            
            Console.WriteLine($"📴 Call {callId} ended by {userId}");
        }
        else
        {
            Console.WriteLine($"❌ Call end failed: {result.Error?.Message}");
            await Clients.Caller.SendAsync("CallError", result.Error?.Message ?? "Failed to end call.");
        }
    }

    public async Task SendWebRTCOffer(Guid callId, string sdp)
    {
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var callResult = await _callService.GetCallByIdAsync(callId);
        if (!callResult.IsSuccess || callResult.Value == null)
        {
            await Clients.Caller.SendAsync("CallError", "Call not found.");
            return;
        }

        var callDto = callResult.Value;
        var signalDto = new WebRTCSignalDto
        {
            CallId = callId,
            Sdp = sdp
        };

        // Send offer to other participants (exclude sender)
        foreach (var participantId in callDto.ParticipantIds.Where(id => id != userId))
        {
            await Clients.User(participantId.ToString()).SendAsync("ReceiveOffer", signalDto);
        }
        
        Console.WriteLine($"📡 WebRTC offer sent for call {callId}");
    }

    public async Task SendWebRTCAnswer(Guid callId, string sdp)
    {
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var callResult = await _callService.GetCallByIdAsync(callId);
        if (!callResult.IsSuccess || callResult.Value == null)
        {
            await Clients.Caller.SendAsync("CallError", "Call not found.");
            return;
        }

        var callDto = callResult.Value;
        var signalDto = new WebRTCSignalDto
        {
            CallId = callId,
            Sdp = sdp
        };

        // Send answer to other participants (exclude sender)
        foreach (var participantId in callDto.ParticipantIds.Where(id => id != userId))
        {
            await Clients.User(participantId.ToString()).SendAsync("ReceiveAnswer", signalDto);
        }
        
        Console.WriteLine($"📡 WebRTC answer sent for call {callId}");
    }

    public async Task SendICECandidate(Guid callId, string candidate, string? sdpMid, int? sdpMLineIndex)
    {
        var userIdString = Context.UserIdentifier;
        
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("CallError", "Invalid user identifier.");
            return;
        }

        var callResult = await _callService.GetCallByIdAsync(callId);
        if (!callResult.IsSuccess || callResult.Value == null)
        {
            await Clients.Caller.SendAsync("CallError", "Call not found.");
            return;
        }

        var callDto = callResult.Value;
        var signalDto = new WebRTCSignalDto
        {
            CallId = callId,
            Candidate = candidate,
            SdpMid = sdpMid,
            SdpMLineIndex = sdpMLineIndex
        };

        // Send ICE candidate to other participants (exclude sender)
        foreach (var participantId in callDto.ParticipantIds.Where(id => id != userId))
        {
            await Clients.User(participantId.ToString()).SendAsync("ReceiveICECandidate", signalDto);
        }
        
        Console.WriteLine($"📡 ICE candidate sent for call {callId}");
    }
}