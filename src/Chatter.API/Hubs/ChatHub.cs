using Chatter.Application.DTOs.Chat;
using Chatter.Application.Services;
using Chatter.Domain.Entities;
using Chatter.Domain.Interfaces;
using Chatter.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Chatter.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;
    private readonly ICallService _callService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly PushNotificationQueue _pushQueue;
    private readonly PresenceTracker _presenceTracker;

    public ChatHub(
        IChatService chatService,
        ICallService callService,
        IUnitOfWork unitOfWork,
        PushNotificationQueue pushQueue,
        PresenceTracker presenceTracker)
    {
        _chatService = chatService;
        _callService = callService;
        _unitOfWork = unitOfWork;
        _pushQueue = pushQueue;
        _presenceTracker = presenceTracker;
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
                var userAgent = Context.GetHttpContext()?.Request.Headers["User-Agent"].ToString();
                var ipAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString();

                var (isFirstConnection, evictedConnectionId) = _presenceTracker.UserConnected(userId, Context.ConnectionId, userAgent, ipAddress);

                // Evict oldest connection if user exceeded the limit
                if (evictedConnectionId != null)
                {
                    await Clients.Client(evictedConnectionId).SendAsync("ForceDisconnect", "Connection limit exceeded. You've been signed in from another device.");
                    Context.GetHttpContext()?.RequestServices
                        .GetService<IHubContext<ChatHub>>()?
                        .Groups.RemoveFromGroupAsync(evictedConnectionId, "*");
                }

                if (isFirstConnection)
                {
                    await Clients.AllExcept(Context.ConnectionId).SendAsync("UserOnline", userId);
                }

                // Join all conversation groups in parallel (not sequential).
                // Sequential: N conversations × ~0.1ms = N*0.1ms
                // Parallel: all conversations in ~0.1ms total via Task.WhenAll
                var userConversationsResult = await _chatService.GetUserConversationsAsync(userId);
                if (userConversationsResult.IsSuccess && userConversationsResult.Value != null)
                {
                    var groupTasks = userConversationsResult.Value.Select(conv =>
                        Groups.AddToGroupAsync(Context.ConnectionId, conv.Id.ToString()));
                    await Task.WhenAll(groupTasks);
                }
                
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
                var isLastConnection = _presenceTracker.UserDisconnected(userId, Context.ConnectionId);
                
                if (isLastConnection)
                {
                    // Force end any active calls when user goes completely offline
                    var endedCalls = await _callService.ForceEndUserCallsAsync(userId);
                    if (endedCalls.IsSuccess && endedCalls.Value > 0)
                    {
                        Console.WriteLine($"🔴 Force ended {endedCalls.Value} call(s) for offline user {userId}");
                        // Notify other participants that call ended
                        await Clients.All.SendAsync("CallEnded", new { userId, reason = "UserDisconnected" });
                    }
                    
                    await Clients.All.SendAsync("UserOffline", userId);
                    Console.WriteLine($"👋 User {userId} went offline");
                }
                else
                {
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
                user.UpdateLastSeen();
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
            var conversationIdStr = messageDto.ConversationId.ToString();

            // Phase 3.1: Broadcast to the conversation group
            await Clients.Group(conversationIdStr).SendAsync("ReceiveMessage", messageDto);

            // Geriye dönük uyumluluk: Sadece ReceiverId varsa özel bir push notification gönder
            if (request.ReceiverId.HasValue)
            {
                Console.WriteLine($"📤 Message sent from {senderId} to {request.ReceiverId.Value} in group {conversationIdStr}");
                
                // Fire-and-forget push notification via background queue.
                // This decouples Firebase latency (~500-2000ms) from the hub method.
                var senderName = Context.User?.FindFirst("FullName")?.Value
                                 ?? Context.User?.Identity?.Name
                                 ?? "Someone";

                var messagePreview = messageDto.Content?.Length > 100
                    ? messageDto.Content.Substring(0, 100) + "..."
                    : messageDto.Content ?? "New message";

                _pushQueue.Enqueue(new PushNotificationMessage(
                    request.ReceiverId.Value,
                    "Chatter",
                    $"{senderName}: {messagePreview}",
                    new Dictionary<string, string>
                    {
                        { "type", "message" },
                        { "senderId", senderId.ToString() },
                        { "conversationId", conversationIdStr }
                    }
                ));
            }
            else
            {
                Console.WriteLine($"📤 Message sent from {senderId} to group {conversationIdStr}");
            }
        }
        else
        {
            Console.WriteLine($"❌ Message send failed from {senderId}: {result.Error?.Message}");
            await Clients.Caller.SendAsync("ErrorMessage", result.Error?.Message ?? "Mesaj gönderileme hatası.");
        }
    }
    // Server-side typing throttle: suppress duplicate typing events within 2 seconds.
    // Without this, each keystroke sends a WebSocket frame (60 WPM = ~5 frames/sec).
    // With throttling: max 1 frame per 2 seconds per (sender, receiver) pair.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, long> _typingThrottle = new();

    public async Task NotifyTyping(Guid receiverId)
    {
        var senderId = Context.UserIdentifier;
        if (string.IsNullOrEmpty(senderId)) return;

        var key = $"{senderId}:{receiverId}";
        var now = Environment.TickCount64;

        var lastSent = _typingThrottle.GetOrAdd(key, 0L);
        if (now - lastSent < 2000) return; // Throttle: 2 second window

        _typingThrottle[key] = now;
        await Clients.User(receiverId.ToString()).SendAsync("UserTyping", senderId);
    }

    public async Task NotifyStoppedTyping(Guid receiverId)
    {
        var senderId = Context.UserIdentifier;
        if (string.IsNullOrEmpty(senderId)) return;

        // Always forward stop events (important for UI cleanup)
        var key = $"{senderId}:{receiverId}";
        _typingThrottle.TryRemove(key, out _);
        await Clients.User(receiverId.ToString()).SendAsync("UserStoppedTyping", senderId);
    }

    // ==================== MESSAGE EDIT ====================

    public async Task EditMessage(Guid messageId, string newContent)
    {
        var userIdString = Context.UserIdentifier;
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("ErrorMessage", "Geçersiz kullanıcı kimliği.");
            return;
        }

        var result = await _chatService.EditMessageAsync(messageId, userId, newContent);
        if (result.IsSuccess)
        {
            var messageDto = result.Value;
            // Phase 3.1: Use Clients.Group instead of iterating through participants
            await Clients.Group(messageDto.ConversationId.ToString()).SendAsync("MessageEdited", messageDto);
        }
        else
        {
            await Clients.Caller.SendAsync("ErrorMessage", result.Error?.Message ?? "Mesaj düzenlenemedi.");
        }
    }

    // ==================== REACTIONS ====================

    public async Task AddReaction(Guid messageId, string emoji)
    {
        var userIdString = Context.UserIdentifier;
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("ErrorMessage", "Geçersiz kullanıcı kimliği.");
            return;
        }

        var result = await _chatService.AddReactionAsync(messageId, userId, emoji);
        if (result.IsSuccess)
        {
            // Mesajın konuşmasını bul ve gruba gönder
            var message = await _unitOfWork.Messages.GetByIdWithDetailsAsync(messageId);
            if (message != null)
            {
                var payload = new { messageId, userId, emoji };
                // Phase 3.1: Broadcast to the whole conversation group
                await Clients.Group(message.ConversationId.ToString()).SendAsync("ReactionAdded", payload);
            }
        }
        else
        {
            await Clients.Caller.SendAsync("ErrorMessage", result.Error?.Message ?? "Reaksiyon eklenemedi.");
        }
    }

    public async Task RemoveReaction(Guid messageId, string emoji)
    {
        var userIdString = Context.UserIdentifier;
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            await Clients.Caller.SendAsync("ErrorMessage", "Geçersiz kullanıcı kimliği.");
            return;
        }

        // Mesajın konuşmasını bul (silmeden önce)
        var message = await _unitOfWork.Messages.GetByIdWithDetailsAsync(messageId);
        if (message == null)
        {
            await Clients.Caller.SendAsync("ErrorMessage", "Mesaj bulunamadı.");
            return;
        }

        var result = await _chatService.RemoveReactionAsync(messageId, userId, emoji);
        if (result.IsSuccess)
        {
            var payload = new { messageId, userId, emoji };
            // Phase 3.1: Broadcast to the whole conversation group
            await Clients.Group(message.ConversationId.ToString()).SendAsync("ReactionRemoved", payload);
        }
        else
        {
            await Clients.Caller.SendAsync("ErrorMessage", result.Error?.Message ?? "Reaksiyon kaldırılamadı.");
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
            
            // Fire-and-forget push notification via background queue
            var initiatorName = Context.User?.FindFirst("FullName")?.Value
                                ?? Context.User?.Identity?.Name
                                ?? "Someone";
            var callTypeText = callType == 0 ? "sesli" : "görüntülü";

            _pushQueue.Enqueue(new PushNotificationMessage(
                receiverId,
                $"{initiatorName}",
                $"{callTypeText} arama yapıyor..."
            ));
            
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
            
            var systemMessage = new Domain.Entities.Message(
                conversationId: callDto.ConversationId,
                senderId: userId,
                content: $"{callTypeText} declined",
                type: Domain.Enums.MessageType.System
            ) { Id = Guid.NewGuid() };
            
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
            
            // Phase 3.1: Broadcast to the conversation group
            await Clients.Group(callDto.ConversationId.ToString()).SendAsync("ReceiveMessage", messageDto);
            
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
                
                var systemMessage = new Domain.Entities.Message(
                    conversationId: callDto.ConversationId,
                    senderId: userId,
                    content: $"{callTypeText} • {durationText}",
                    type: Domain.Enums.MessageType.System
                ) { Id = Guid.NewGuid() };
                
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
                
                // Phase 3.1: Broadcast to the conversation group
            await Clients.Group(callDto.ConversationId.ToString()).SendAsync("ReceiveMessage", messageDto);
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

    /// <summary>
    /// Batched ICE candidate delivery. Receives multiple candidates in one WebSocket frame
    /// instead of 20-50 individual frames during call setup.
    /// </summary>
    public async Task SendICECandidates(Guid callId, List<ICECandidateDto> candidates)
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

        // Forward all candidates to other participants in a single batch
        foreach (var participantId in callDto.ParticipantIds.Where(id => id != userId))
        {
            foreach (var candidate in candidates)
            {
                var signalDto = new WebRTCSignalDto
                {
                    CallId = callId,
                    Candidate = candidate.Candidate,
                    SdpMid = candidate.SdpMid,
                    SdpMLineIndex = candidate.SdpMLineIndex
                };
                await Clients.User(participantId.ToString()).SendAsync("ReceiveICECandidate", signalDto);
            }
        }

        Console.WriteLine($"📡 {candidates.Count} batched ICE candidates sent for call {callId}");
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