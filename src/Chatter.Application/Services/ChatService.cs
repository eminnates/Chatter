using Chatter.Application.Common;
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

    public async Task<Result<MessageDto?>> GetLastMessageAsync(Guid conversationId)
    {
        // Son mesajı (silinmiş dahil) getir
        var message = await _unitOfWork.Messages.GetLastMessageAsync(conversationId);
        if (message == null)
            return Result<MessageDto?>.Success(null);

        var replyDto = message.ReplyToMessage != null ? new ReplyMessageDto
        {
            Id = message.ReplyToMessage.Id,
            SenderId = message.ReplyToMessage.SenderId,
            SenderName = message.ReplyToMessage.Sender?.FullName ?? message.ReplyToMessage.Sender?.UserName ?? string.Empty,
            Content = message.ReplyToMessage.Content
        } : null;

        var dto = new MessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            SenderName = message.Sender?.FullName ?? message.Sender?.UserName ?? "Unknown",
            Content = message.Content,
            Type = message.Type.ToString(),
            SentAt = message.SentAt,
            IsRead = message.Status == MessageStatus.Read,
            ReplyToMessageId = message.ReplyToMessageId,
            ReplyMessage = replyDto,
            Attachments = message.Attachments?.Select(a => new MessageAttachmentDto
            {
                FileName = a.FileName,
                FileUrl = a.FileUrl,
                Type = a.Type.ToString()
            }).ToList(),
            Reactions = message.Reactions?.Select(r => new MessageReactionDto
            {
                UserId = r.UserId,
                Emoji = r.Emoji
            }).ToList() ?? new List<MessageReactionDto>()
        };
        return Result<MessageDto?>.Success(dto);
    }

    public async Task<Result<MessageDto>> SendMessageAsync(SendMessageRequest request, Guid senderId)
    {
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            Conversation? conversation = null;

            // 1. Konuşmayı Bul veya Oluştur
            if (request.ConversationId.HasValue)
            {
                conversation = await _unitOfWork.Conversations.GetByIdWithParticipantsAsync(request.ConversationId.Value);
            }
            else if (request.ReceiverId.HasValue)
            {
                var receiverGuid = request.ReceiverId.Value;
                conversation = await _unitOfWork.Conversations.GetOneToOneConversationAsync(senderId, receiverGuid);
                
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
                        new() { ConversationId = conversation.Id, UserId = receiverGuid, Role = ParticipantRole.Member }
                    };
                    
                    conversation.Participants = participants;
                    await _unitOfWork.SaveChangesAsync(); 
                }
            }

            if (conversation == null)
            {
                await _unitOfWork.RollbackTransactionAsync();
                return Result<MessageDto>.Failure(new Error("Chat.ConversationError", "Konuşma bulunamadı."));
            }

            // 2. Mesajı Oluştur
            var message = new Message
            {
                ConversationId = conversation.Id,
                SenderId = senderId,
                Content = request.Content ?? (request.Attachment != null ? "" : string.Empty),
                Type = request.Attachment != null ? (MessageType)request.Attachment.Type : MessageType.Text,
                SentAt = DateTime.UtcNow,
                Status = MessageStatus.Sent,
                ReplyToMessageId = request.ReplyToMessageId
            };

            // EKLERİ KAYDET
            if (request.Attachment != null)
            {
                var attachment = new MessageAttachment
                {
                    MessageId = message.Id,
                    FileName = request.Attachment.FileName,
                    FileUrl = request.Attachment.FileUrl,
                    Type = (AttachmentType)request.Attachment.Type,
                    FileSize = request.Attachment.FileSize,
                    MimeType = request.Attachment.MimeType,
                    UploadedAt = DateTime.UtcNow
                };
                message.Attachments.Add(attachment);
            }

            await _unitOfWork.Messages.AddAsync(message);
            await _unitOfWork.SaveChangesAsync();
            
            // 3. Konuşma Bilgilerini Güncelle
            conversation.LastMessageId = message.Id;
            conversation.UpdatedAt = DateTime.UtcNow;
            
            foreach (var participant in conversation.Participants.Where(p => p.UserId != senderId))
            {
                participant.UnreadCount++;
            }

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();

            // 4. DTO DÖNDÜR
            ReplyMessageDto? replyDto = null;
            if (message.ReplyToMessageId.HasValue)
            {
                var reply = await _unitOfWork.Messages.GetByIdWithDetailsAsync(message.ReplyToMessageId.Value);
                if (reply != null)
                {
                    replyDto = new ReplyMessageDto
                    {
                        Id = reply.Id,
                        SenderId = reply.SenderId,
                        SenderName = reply.Sender?.FullName ?? reply.Sender?.UserName ?? string.Empty,
                        Content = reply.Content
                    };
                }
            }

            var messageDto = new MessageDto
            {
                Id = message.Id,
                ConversationId = conversation.Id,
                SenderId = senderId,
                SenderName = "", 
                Content = message.Content,
                SentAt = message.SentAt,
                IsRead = false,
                ReplyToMessageId = message.ReplyToMessageId,
                ReplyMessage = replyDto,
                Attachments = message.Attachments.Select(a => new MessageAttachmentDto {
                    FileName = a.FileName,
                    FileUrl = a.FileUrl,
                    Type = a.Type.ToString(),
                    FileSize = a.FileSize
                }).ToList()
            };

            return Result<MessageDto>.Success(messageDto);
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackTransactionAsync();
            return Result<MessageDto>.Failure(new Error("Chat.SendException", $"Mesaj gönderilemedi: {ex.Message}"));
        }
    }

    public async Task<Result<IEnumerable<MessageDto>>> GetConversationMessagesAsync(Guid conversationId, int pageNumber, int pageSize, Guid userId)
    {
        // Yetki Kontrolü
        var isParticipant = await _unitOfWork.Conversations.IsUserInConversationAsync(conversationId, userId);
        if (!isParticipant)
            return Result<IEnumerable<MessageDto>>.Failure(new Error("Chat.AccessDenied", "Bu konuşmaya erişim yetkiniz yok."));

        var messages = await _unitOfWork.Messages.GetConversationMessagesAsync(conversationId, pageNumber, pageSize);
        
        var dtos = messages.Select(m => new MessageDto
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId,
            SenderName = m.Sender?.FullName ?? m.Sender?.UserName ?? "Unknown",
            Content = m.Content,
            Type = m.Type.ToString(),
            SentAt = m.SentAt,
            IsRead = m.Status == MessageStatus.Read,
            ReplyToMessageId = m.ReplyToMessageId,
            ReplyMessage = m.ReplyToMessage != null ? new ReplyMessageDto
            {
                Id = m.ReplyToMessage.Id,
                SenderId = m.ReplyToMessage.SenderId,
                SenderName = m.ReplyToMessage.Sender?.FullName ?? m.ReplyToMessage.Sender?.UserName ?? string.Empty,
                Content = m.ReplyToMessage.Content
            } : null,
            EditedAt = m.EditedAt,
            Attachments = m.Attachments.Select(a => new MessageAttachmentDto {
                FileUrl = a.FileUrl,
                FileName = a.FileName,
                Type = a.Type.ToString(),
                FileSize = a.FileSize
            }).ToList(),
            Reactions = m.Reactions?.Select(r => new MessageReactionDto
            {
                UserId = r.UserId,
                Emoji = r.Emoji
            }).ToList() ?? new List<MessageReactionDto>()
        });

        return Result<IEnumerable<MessageDto>>.Success(dtos);
    }

    public async Task<Result<IEnumerable<ConversationDto>>> GetUserConversationsAsync(Guid userId)
    {
        var conversations = await _unitOfWork.Conversations.GetUserConversationsAsync(userId);
        
        var dtos = conversations.Select(c => {
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
                    ReplyToMessageId = c.LastMessage.ReplyToMessageId,
                    ReplyMessage = c.LastMessage.ReplyToMessage != null ? new ReplyMessageDto
                    {
                        Id = c.LastMessage.ReplyToMessage.Id,
                        SenderId = c.LastMessage.ReplyToMessage.SenderId,
                        SenderName = c.LastMessage.ReplyToMessage.Sender?.FullName ?? c.LastMessage.ReplyToMessage.Sender?.UserName ?? string.Empty,
                        Content = c.LastMessage.ReplyToMessage.Content
                    } : null
                } : null,
                LastMessageTime = c.LastMessage?.SentAt ?? c.CreatedAt,
                UnreadCount = myParticipant?.UnreadCount ?? 0,
                IsGroup = c.Type == ConversationType.Group,
                IsOnline = otherParticipant?.IsOnline ?? false,
                Type = c.Type.ToString()
            };
        });

        return Result<IEnumerable<ConversationDto>>.Success(dtos);
    }

    public async Task<Result<bool>> MarkMessagesAsReadAsync(Guid conversationId, Guid userId)
    {
        await _unitOfWork.Messages.MarkMessagesAsReadAsync(conversationId, userId);
        
        var conversation = await _unitOfWork.Conversations.GetByIdWithParticipantsAsync(conversationId);
        
        if (conversation == null)
             return Result<bool>.Failure(new Error("Chat.NotFound", "Konuşma bulunamadı."));

        var participant = conversation.Participants.FirstOrDefault(p => p.UserId == userId);
        
        if (participant != null)
        {
            participant.UnreadCount = 0;
            participant.LastReadAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync();
        }

        return Result<bool>.Success(true);
    }

    public async Task<Result<Guid>> CreatePrivateConversationAsync(Guid senderId, Guid receiverId)
    {
        var existing = await _unitOfWork.Conversations.GetOneToOneConversationAsync(senderId, receiverId);
        if (existing != null) 
            return Result<Guid>.Success(existing.Id);

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
        
        return Result<Guid>.Success(conversation.Id);
    }

    public async Task<Result<MessageDto>> EditMessageAsync(Guid messageId, Guid userId, string newContent)
    {
        var canEdit = await _unitOfWork.Messages.CanUserEditMessageAsync(messageId, userId);
        if (!canEdit)
            return Result<MessageDto>.Failure(new Error("Chat.EditDenied", "Bu mesajı düzenleme yetkiniz yok."));

        // GetByIdAsync returns a tracked entity (uses FindAsync)
        var trackedMessage = await _unitOfWork.Messages.GetByIdAsync(messageId);
        if (trackedMessage == null)
            return Result<MessageDto>.Failure(new Error("Chat.NotFound", "Mesaj bulunamadı."));

        trackedMessage.Edit(newContent);
        await _unitOfWork.SaveChangesAsync();

        // Re-fetch with details for the DTO (AsNoTracking is fine here)
        var message = await _unitOfWork.Messages.GetByIdWithDetailsAsync(messageId);
        if (message == null)
            return Result<MessageDto>.Failure(new Error("Chat.NotFound", "Mesaj bulunamadı."));

        var dto = new MessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            SenderId = message.SenderId,
            SenderName = message.Sender?.FullName ?? message.Sender?.UserName ?? "Unknown",
            Content = message.Content,
            Type = message.Type.ToString(),
            SentAt = message.SentAt,
            EditedAt = message.EditedAt,
            IsRead = message.Status == MessageStatus.Read,
            ReplyToMessageId = message.ReplyToMessageId,
            Attachments = message.Attachments?.Select(a => new MessageAttachmentDto
            {
                FileName = a.FileName,
                FileUrl = a.FileUrl,
                Type = a.Type.ToString()
            }).ToList(),
            Reactions = message.Reactions?.Select(r => new MessageReactionDto
            {
                UserId = r.UserId,
                Emoji = r.Emoji
            }).ToList() ?? new List<MessageReactionDto>()
        };

        return Result<MessageDto>.Success(dto);
    }

    public async Task<Result<IEnumerable<MessageDto>>> SearchMessagesAsync(Guid conversationId, Guid userId, string query)
    {
        var isParticipant = await _unitOfWork.Conversations.IsUserInConversationAsync(conversationId, userId);
        if (!isParticipant)
            return Result<IEnumerable<MessageDto>>.Failure(new Error("Chat.AccessDenied", "Bu konuşmaya erişim yetkiniz yok."));

        var messages = await _unitOfWork.Messages.SearchMessagesAsync(conversationId, query);

        var dtos = messages.Select(m => new MessageDto
        {
            Id = m.Id,
            ConversationId = m.ConversationId,
            SenderId = m.SenderId,
            SenderName = m.Sender?.FullName ?? m.Sender?.UserName ?? "Unknown",
            Content = m.Content,
            Type = m.Type.ToString(),
            SentAt = m.SentAt,
            EditedAt = m.EditedAt,
            IsRead = m.Status == MessageStatus.Read,
        });

        return Result<IEnumerable<MessageDto>>.Success(dtos);
    }

    public async Task<Result<MessageReactionDto>> AddReactionAsync(Guid messageId, Guid userId, string emoji)
    {
        var message = await _unitOfWork.Messages.GetByIdWithDetailsAsync(messageId);
        if (message == null)
            return Result<MessageReactionDto>.Failure(new Error("Chat.NotFound", "Mesaj bulunamadı."));

        var existing = await _unitOfWork.Messages.GetUserReactionAsync(messageId, userId);
        if (existing != null)
        {
            if (existing.Emoji == emoji) 
                return Result<MessageReactionDto>.Success(new MessageReactionDto { UserId = userId, Emoji = emoji });
            
            existing.Emoji = emoji;
            await _unitOfWork.SaveChangesAsync();
            return Result<MessageReactionDto>.Success(new MessageReactionDto { UserId = userId, Emoji = emoji });
        }

        var reaction = new MessageReaction
        {
            MessageId = messageId,
            UserId = userId,
            Emoji = emoji
        };

        await _unitOfWork.Messages.AddReactionAsync(reaction);
        await _unitOfWork.SaveChangesAsync();

        return Result<MessageReactionDto>.Success(new MessageReactionDto { UserId = userId, Emoji = emoji });
    }

    public async Task<Result<bool>> RemoveReactionAsync(Guid messageId, Guid userId, string emoji)
    {
        var existing = await _unitOfWork.Messages.GetReactionAsync(messageId, userId, emoji);
        if (existing == null)
            return Result<bool>.Failure(new Error("Chat.NotFound", "Reaksiyon bulunamadı."));

        await _unitOfWork.Messages.RemoveReactionAsync(existing);
        await _unitOfWork.SaveChangesAsync();

        return Result<bool>.Success(true);
    }
}