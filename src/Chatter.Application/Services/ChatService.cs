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

            // 4. DTO DÖNDÜR (BURASI KRİTİK: Attachments eklendi)
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
                // ANLIK GÖRÜNTÜ İÇİN EKLERİ BURAYA DA EKLEMELİSİN
                Attachments = message.Attachments.Select(a => new MessageAttachmentDto {
                    FileName = a.FileName,
                    FileUrl = a.FileUrl,
                    Type = a.Type.ToString()
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
            SentAt = m.SentAt,
            IsRead = m.Status == MessageStatus.Read,
            // DÜZELTME (HATA 2): .ToString() kaldırıldı
            ReplyToMessageId = m.ReplyToMessageId,
            Attachments = m.Attachments.Select(a => new MessageAttachmentDto {
            FileUrl = a.FileUrl,
            FileName = a.FileName,
            Type = a.Type.ToString()
            }).ToList(),
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
                    // DÜZELTME (HATA 3): .ToString() kaldırıldı
                    ReplyToMessageId = c.LastMessage.ReplyToMessageId
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
}