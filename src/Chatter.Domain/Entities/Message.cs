using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class Message : BaseEntity<Guid>
    {
        public Guid ConversationId { get; private set; }
        public Guid SenderId { get; private set; } 
        public string Content { get; private set; } = string.Empty;
        public MessageType Type { get; private set; } = MessageType.Text;
        public MessageStatus Status { get; private set; } = MessageStatus.Sent;
        public DateTime SentAt { get; private set; } = DateTime.UtcNow;
        public DateTime? DeliveredAt { get; private set; }
        public DateTime? ReadAt { get; private set; }
        public DateTime? EditedAt { get; private set; }
        
        // Soft Delete (Veri tabanında kalır ama silindi görünür)
        public bool IsDeleted { get; private set; }
        public DateTime? DeletedAt { get; private set; }
        
        public Guid? ReplyToMessageId { get; private set; }

        // Navigation properties
        public virtual Conversation Conversation { get; private set; } = null!;
        public virtual AppUser Sender { get; private set; } = null!;
        public virtual Message? ReplyToMessage { get; private set; }
        public virtual ICollection<Message> Replies { get; private set; } = new List<Message>();
        public virtual ICollection<MessageAttachment> Attachments { get; private set; } = new List<MessageAttachment>();
        public virtual ICollection<MessageReaction> Reactions { get; private set; } = new List<MessageReaction>();

        // EF Core için parametresiz constructor
        protected Message() { }

        public Message(Guid conversationId, Guid senderId, string content, MessageType type = MessageType.Text, Guid? replyToMessageId = null)
        {
            if (conversationId == Guid.Empty) throw new MessageException("Message oluşturmak için geçerli bir ConversationId gereklidir.");
            if (senderId == Guid.Empty) throw new MessageException("Message oluşturmak için geçerli bir SenderId gereklidir.");

            ConversationId = conversationId;
            SenderId = senderId;
            Content = content ?? string.Empty;
            Type = type;
            SentAt = DateTime.UtcNow;
            Status = MessageStatus.Sent;
            ReplyToMessageId = replyToMessageId;
            IsDeleted = false;
        }

        // Domain methods
        public void MarkAsDelivered()
        {
            if (Status != MessageStatus.Sent)
                return;

            Status = MessageStatus.Delivered;
            DeliveredAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void MarkAsRead()
        {
            if (Status == MessageStatus.Read)
                return;

            Status = MessageStatus.Read;
            ReadAt = DateTime.UtcNow;
            if (!DeliveredAt.HasValue)
            {
                DeliveredAt = DateTime.UtcNow;
            }

            UpdatedAt = DateTime.UtcNow;
        }

        public void MarkAsFailed()
        {
            if (Status == MessageStatus.Delivered || Status == MessageStatus.Read)
            {
                return;
            }

            Status = MessageStatus.Failed;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Edit(Guid userId, string newContent)
        {
            if (SenderId != userId)
            {
                throw new MessageException("Sadece mesajın kendi göndericisi (sahibi) mesajı düzenleyebilir.");
            }

            if (IsDeleted)
            {
                throw new MessageException("Silinmiş bir mesaj düzenlenemez.");
            }

            if (Type != MessageType.Text)
            {
                throw new MessageException("Sadece metin (text) içerikli mesajlar düzenlenebilir.");
            }

            if (string.IsNullOrWhiteSpace(newContent))
            {
                throw new MessageException("Mesaj içeriği boş bırakılamaz.");
            }

            Content = newContent;
            EditedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Delete(Guid userId)
        {
            if (SenderId != userId)
            {
                throw new MessageException("Sadece mesajın kendi göndericisi (sahibi) mesajı silebilir.");
            }

            if (IsDeleted)
            {
                throw new MessageException("Silinmiş bir mesaj silinemez.");
            }

            IsDeleted = true;
            DeletedAt = DateTime.UtcNow;
            Content = "Bu mesaj silindi"; 
            UpdatedAt = DateTime.UtcNow;
        }

        public bool CanBeEdited(Guid userId) => SenderId == userId && !IsDeleted && Type == MessageType.Text;
        
        public bool CanBeDeleted(Guid userId) => SenderId == userId && !IsDeleted;

        public bool IsReply() => ReplyToMessageId.HasValue;

        public bool HasAttachments() => Attachments.Count > 0;

        public int GetReactionCount() => Reactions.Count;
    }
}