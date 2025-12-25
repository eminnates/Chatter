using Chatter.Application.DTOs.Chat;
using Chatter.Domain.Entities;
using Chatter.Domain.Enums;
using Chatter.Domain.Interfaces;

namespace Chatter.Application.Services;

public class ChatService : IChatService
{
    private readonly IUnitOfWork _unitOfWork;

    public ChatService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<MessageDto> SendMessageAsync(SendMessageRequest request, string senderId)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            Conversation? conversation = null;

            if (request.ConversationId.HasValue)
            {
                conversation = await _unitOfWork.Conversations.GetByIdWithParticipantsAsync(request.ConversationId.Value);
            }
            else if (!string.IsNullOrEmpty(request.ReceiverId))
            {
                conversation = await _unitOfWork.Conversations.GetOneToOneConversationAsync(senderId, request.ReceiverId);
                
                if (conversation == null)
                {
                    conversation = new Conversation
                    {
                        Type = ConversationType.OneToOne,
                        CreatedAt = DateTime.UtcNow,
                        IsActive = true
                    };

                    await _unitOfWork.Conversations.AddAsync(conversation);
                    
                    var participants = new List<ConversationParticipant>
                    {
                        new() { ConversationId = conversation.Id, UserId = senderId, Role = ParticipantRole.Member },
                        new() { ConversationId = conversation.Id, UserId = request.ReceiverId, Role = ParticipantRole.Member }
                    };
                    
                    conversation.Participants = participants;

                    // Save conversation first to generate ID and avoid circular dependency with Message
                    await _unitOfWork.SaveChangesAsync();
                }
            }

            if (conversation == null)
                throw new InvalidOperationException("Konuşma bulunamadı veya oluşturulamadı.");

            var message = new Message
            {
                ConversationId = conversation.Id,
                SenderId = senderId,
                Content = request.Content,
                SentAt = DateTime.UtcNow,
                Status = MessageStatus.Sent,
                Type = MessageType.Text,
                ReplyToMessageId = !string.IsNullOrEmpty(request.ReplyToMessageId) ? Guid.Parse(request.ReplyToMessageId) : null
            };

            await _unitOfWork.Messages.AddAsync(message);
            
            // Save message to generate ID
            await _unitOfWork.SaveChangesAsync();
            
            conversation.LastMessageId = message.Id;
            conversation.UpdatedAt = DateTime.UtcNow;
            
            foreach (var participant in conversation.Participants.Where(p => p.UserId != senderId))
            {
                participant.UnreadCount++;
            }

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();

            return new MessageDto
            {
                Id = message.Id,
                ConversationId = conversation.Id,
                SenderId = senderId,
                SenderName = "", 
                Content = message.Content,
                SentAt = message.SentAt,
                IsRead = false,
                ReplyToMessageId = message.ReplyToMessageId?.ToString()
            };
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, int pageNumber, int pageSize, string userId)
    {
        var isParticipant = await _unitOfWork.Conversations.IsUserInConversationAsync(conversationId, userId);
        if (!isParticipant)
            throw new UnauthorizedAccessException("Bu konuşmaya erişim yetkiniz yok.");

        var messages = await _unitOfWork.Messages.GetConversationMessagesAsync(conversationId, pageNumber, pageSize);
        
        return messages.Select(m => new MessageDto
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId,
            SenderName = m.Sender?.FullName ?? m.Sender?.UserName ?? "Unknown",
            Content = m.Content,
            SentAt = m.SentAt,
            IsRead = m.Status == MessageStatus.Read,
            ReplyToMessageId = m.ReplyToMessageId?.ToString()
        });
    }

    public async Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(string userId)
    {
        var conversations = await _unitOfWork.Conversations.GetUserConversationsAsync(userId);
        
        return conversations.Select(c => {
            var otherParticipant = c.Type == ConversationType.OneToOne 
                ? c.Participants.FirstOrDefault(p => p.UserId != userId)?.User 
                : null;
                
            var myParticipant = c.Participants.FirstOrDefault(p => p.UserId == userId);

            return new ConversationDto
            {
                Id = c.Id,
                Name = c.Type == ConversationType.Group ? c.Name : (otherParticipant?.FullName ?? "Unknown"),
                ImageUrl = c.Type == ConversationType.Group ? c.GroupImageUrl : otherParticipant?.ProfilePictureUrl,
                LastMessage = c.LastMessage != null ? new MessageDto 
                {
                    Id = c.LastMessage.Id,
                    ConversationId = c.Id,
                    SenderId = c.LastMessage.SenderId,
                    SenderName = c.LastMessage.Sender?.FullName ?? "",
                    Content = c.LastMessage.Content,
                    SentAt = c.LastMessage.SentAt,
                    IsRead = c.LastMessage.Status == MessageStatus.Read,
                    ReplyToMessageId = c.LastMessage.ReplyToMessageId?.ToString()
                } : null,
                LastMessageTime = c.LastMessage?.SentAt ?? c.CreatedAt,
                UnreadCount = myParticipant?.UnreadCount ?? 0,
                IsGroup = c.Type == ConversationType.Group,
                IsOnline = otherParticipant?.IsOnline ?? false,
                Type = c.Type.ToString()
            };
        });
    }

    public async Task MarkMessagesAsReadAsync(Guid conversationId, string userId)
    {
        await _unitOfWork.Messages.MarkMessagesAsReadAsync(conversationId, userId);
        
        var conversation = await _unitOfWork.Conversations.GetByIdWithParticipantsAsync(conversationId);
        var participant = conversation?.Participants.FirstOrDefault(p => p.UserId == userId);
        
        if (participant != null)
        {
            participant.UnreadCount = 0;
            participant.LastReadAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();
        }
    }

    public async Task<Guid> CreatePrivateConversationAsync(string senderId, string receiverId)
    {
        var existing = await _unitOfWork.Conversations.GetOneToOneConversationAsync(senderId, receiverId);
        if (existing != null) return existing.Id;

        var conversation = new Conversation
        {
            Type = ConversationType.OneToOne,
            CreatedAt = DateTime.UtcNow,
            IsActive = true,
            Participants = new List<ConversationParticipant>
            {
                new() { UserId = senderId, Role = ParticipantRole.Member },
                new() { UserId = receiverId, Role = ParticipantRole.Member }
            }
        };

        await _unitOfWork.Conversations.AddAsync(conversation);
        await _unitOfWork.SaveChangesAsync();
        
        return conversation.Id;
    }
}
