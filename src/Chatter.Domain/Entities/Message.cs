using Chatter.Domain.Common;
using Chatter.Domain.Enums;

namespace Chatter.Domain.Entities
{
    public class Message : BaseEntity<Guid>
    {
        public Guid ConversationId { get; set; }
        public string SenderId { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public MessageType Type { get; set; } = MessageType.Text;
        public MessageStatus Status { get; set; } = MessageStatus.Sent;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? DeliveredAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public DateTime? EditedAt { get; set; }
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
            if (Status == MessageStatus.Sent)
            {
                Status = MessageStatus.Delivered;
                DeliveredAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void MarkAsRead()
        {
            if (Status != MessageStatus.Read)
            {
                Status = MessageStatus.Read;
                ReadAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void MarkAsFailed()
        {
            Status = MessageStatus.Failed;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Edit(string newContent)
        {
            if (!IsDeleted && Type == MessageType.Text)
            {
                Content = newContent;
                EditedAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void Delete()
        {
            IsDeleted = true;
            DeletedAt = DateTime.UtcNow;
            Content = "This message was deleted";
            UpdatedAt = DateTime.UtcNow;
        }

        public bool CanBeEdited() => !IsDeleted && Type == MessageType.Text;
        
        public bool CanBeDeleted() => !IsDeleted;

        public bool IsReply() => ReplyToMessageId.HasValue;

        public bool HasAttachments() => Attachments.Any();

        public int GetReactionCount() => Reactions.Count;
    }
}
