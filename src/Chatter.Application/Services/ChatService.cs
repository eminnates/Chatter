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

        var dto = MapToMessageDto(message);
        
        return Result<MessageDto?>.Success(dto);
    }

    public async Task<Result<MessageDto>> SendMessageAsync(SendMessageRequest request, Guid senderId)
    {
        try
        {
            if (request.Content != null && request.Content.Length > 5000)
                return Result<MessageDto>.Failure(new Error("Chat.MessageTooLong", "Mesaj 5000 karakterden uzun olamaz."));

            var sender = await _unitOfWork.Users.GetByIdAsync(senderId);
            if (sender == null)
            {
                return Result<MessageDto>.Failure(new Error("Chat.UserNotFound", "Gönderici bulunamadı."));
            }
            var senderName = sender.FullName ?? sender.UserName ?? string.Empty;

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
                    conversation = new Conversation(type: ConversationType.OneToOne) { Id = Guid.NewGuid() };
                    await _unitOfWork.Conversations.AddAsync(conversation);
                    
                    conversation.AddParticipant(new ConversationParticipant(conversationId: conversation.Id, userId: senderId, role: ParticipantRole.Member));
                    conversation.AddParticipant(new ConversationParticipant(conversationId: conversation.Id, userId: receiverGuid, role: ParticipantRole.Member));
                }
            }

            if (conversation == null)
            {
                return Result<MessageDto>.Failure(new Error("Chat.ConversationError", "Konuşma bulunamadı."));
            }

            // 2. Reply Fetch Optimization (SaveChanges öncesine alındı)
            ReplyMessageDto? replyDto = null;
            if (request.ReplyToMessageId.HasValue)
            {
                var reply = await _unitOfWork.Messages.GetByIdWithDetailsAsync(request.ReplyToMessageId.Value);
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

            // 3. Mesajı Oluştur
            var messageType = request.Attachment != null ? (MessageType)request.Attachment.Type : MessageType.Text;
            var message = new Message(
                conversationId: conversation.Id,
                senderId: senderId,
                content: request.Content ?? (request.Attachment != null ? "" : string.Empty),
                type: messageType,
                replyToMessageId: request.ReplyToMessageId
            ) { Id = Guid.NewGuid() };

            // EKLERİ KAYDET
            if (request.Attachment != null)
            {
                var attachment = new MessageAttachment(
                    messageId: message.Id,
                    fileName: request.Attachment.FileName,
                    fileUrl: request.Attachment.FileUrl,
                    type: (AttachmentType)request.Attachment.Type
                ) { Id = Guid.NewGuid() };

                // KURALLARI İŞLETİYORUZ
                attachment.SetMetadata(
                    fileSize: request.Attachment.FileSize,
                    mimeType: request.Attachment.MimeType,
                    width: request.Attachment.Width,
                    height: request.Attachment.Height,
                    duration: request.Attachment.Duration
                );

                message.Attachments.Add(attachment);
            }

            await _unitOfWork.Messages.AddAsync(message);
            
            // 4. Konuşma Bilgilerini Güncelle
            conversation.UpdateLastMessage(message);
            
            if (conversation.Participants != null)
            {
                foreach (var participant in conversation.Participants.Where(p => p.UserId != senderId))
                {
                    participant.IncrementUnreadCount();
                }
            }

            // TEK SAVECHANGES
            await _unitOfWork.SaveChangesAsync();

            // 5. DTO DÖNDÜR
            var messageDto = MapToMessageDto(message, request.ClientMessageId);
            
            // Eğer Reply fetch optimize edildiyse Set ediyoruz (Veritabanındaki mapping içinde olmadığı için extra set ediyoruz)
            if (replyDto != null && messageDto.ReplyMessage == null)
            {
                messageDto.ReplyMessage = replyDto;
            }

            return Result<MessageDto>.Success(messageDto);
        }
        catch (Exception ex)
        {
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
        
        var dtos = messages.Select(m => MapToMessageDto(m));

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
                LastMessage = c.LastMessage != null ? MapToMessageDto(c.LastMessage) : null,
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
            participant.MarkAsRead(DateTime.UtcNow);
            await _unitOfWork.SaveChangesAsync();
        }

        return Result<bool>.Success(true);
    }

    public async Task<Result<Guid>> CreatePrivateConversationAsync(Guid senderId, Guid receiverId)
    {
        var existing = await _unitOfWork.Conversations.GetOneToOneConversationAsync(senderId, receiverId);
        if (existing != null) 
            return Result<Guid>.Success(existing.Id);

        var conversation = new Conversation(type: ConversationType.OneToOne);
        
        conversation.AddParticipant(new ConversationParticipant(conversationId: conversation.Id, userId: senderId, role: ParticipantRole.Member));
        conversation.AddParticipant(new ConversationParticipant(conversationId: conversation.Id, userId: receiverId, role: ParticipantRole.Member));

        await _unitOfWork.Conversations.AddAsync(conversation);
        await _unitOfWork.SaveChangesAsync();
        
        return Result<Guid>.Success(conversation.Id);
    }

    public async Task<Result<MessageDto>> EditMessageAsync(Guid messageId, Guid userId, string newContent)
    {
        var message = await _unitOfWork.Messages.GetByIdWithDetailsAsync(messageId);
        if (message == null)
            return Result<MessageDto>.Failure(new Error("Chat.NotFound", "Mesaj bulunamadı."));

        message.Edit(userId, newContent);
        
        _unitOfWork.Messages.Update(message);
        await _unitOfWork.SaveChangesAsync();

        var dto = MapToMessageDto(message);

        return Result<MessageDto>.Success(dto);
    }

    public async Task<Result<IEnumerable<MessageDto>>> SearchMessagesAsync(Guid conversationId, Guid userId, string query)
    {
        var isParticipant = await _unitOfWork.Conversations.IsUserInConversationAsync(conversationId, userId);
        if (!isParticipant)
            return Result<IEnumerable<MessageDto>>.Failure(new Error("Chat.AccessDenied", "Bu konuşmaya erişim yetkiniz yok."));

        var messages = await _unitOfWork.Messages.SearchMessagesAsync(conversationId, query);

        var dtos = messages.Select(m => MapToMessageDto(m));

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
            
            existing.ChangeEmoji(emoji);
            await _unitOfWork.SaveChangesAsync();
            return Result<MessageReactionDto>.Success(new MessageReactionDto { UserId = userId, Emoji = emoji });
        }

        var reaction = new MessageReaction(messageId, userId, emoji);

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

    public async Task<Result<IEnumerable<MessageDto>>> GetMessagesSinceAsync(Guid conversationId, DateTime since, Guid userId)
    {
        try
        {
            var messages = await _unitOfWork.Messages.GetMessagesSinceAsync(conversationId, since);
            var dtos = messages.Select(m => MapToMessageDto(m));
            return Result<IEnumerable<MessageDto>>.Success(dtos);
        }
        catch (Exception ex)
        {
            return Result<IEnumerable<MessageDto>>.Failure(new Error("Chat.GetSinceFailed", ex.Message));
        }
    }

    // --- HELPER METHODS ---
    private static MessageDto MapToMessageDto(Message message, string? clientMessageId = null)
    {
        return new MessageDto
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
            ReplyMessage = message.ReplyToMessage != null ? new ReplyMessageDto
            {
                Id = message.ReplyToMessage.Id,
                SenderId = message.ReplyToMessage.SenderId,
                SenderName = message.ReplyToMessage.Sender?.FullName ?? message.ReplyToMessage.Sender?.UserName ?? string.Empty,
                Content = message.ReplyToMessage.Content
            } : null,
            Attachments = message.Attachments?.Select(a => new MessageAttachmentDto
            {
                FileName = a.FileName,
                FileUrl = a.FileUrl,
                Type = a.Type.ToString(),
                FileSize = a.FileSize,
                FileSizeFormatted = a.GetFileSizeFormatted(),
                DurationFormatted = a.GetDurationFormatted(),
                Width = a.Width,
                Height = a.Height
            }).ToList() ?? new List<MessageAttachmentDto>(),
            Reactions = message.Reactions?.Select(r => new MessageReactionDto
            {
                UserId = r.UserId,
                Emoji = r.Emoji
            }).ToList() ?? new List<MessageReactionDto>(),
            ClientMessageId = clientMessageId
        };
    }
}