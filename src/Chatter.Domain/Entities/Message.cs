using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class Message : BaseEntity<Guid>
    {
        public Guid ConversationId { get; set; }
        public Guid SenderId { get; set; } 
        public string Content { get; set; } = string.Empty;
        public MessageType Type { get; set; } = MessageType.Text;
        public MessageStatus Status { get; set; } = MessageStatus.Sent;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? DeliveredAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public DateTime? EditedAt { get; set; }
        
        // Soft Delete (Veri tabanında kalır ama silindi görünür)
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        
        public Guid? ReplyToMessageId { get; set; }

        // Navigation properties
        public virtual Conversation Conversation { get; set; } = null!;
        public virtual AppUser Sender { get; set; } = null!;
        public virtual Message? ReplyToMessage { get; set; }
        public virtual ICollection<Message> Replies { get; set; } = new List<Message>();
        public virtual ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
        public virtual ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();

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