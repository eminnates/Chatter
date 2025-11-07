using Chatter.Domain.Common;
using Chatter.Domain.Enums;

namespace Chatter.Domain.Entities
{
    public class Conversation : BaseEntity<Guid>
    {
        public string? Name { get; set; }
        public ConversationType Type { get; set; } = ConversationType.OneToOne;
        public string? GroupImageUrl { get; set; }
        public string? CreatedByUserId { get; set; }
        public Guid? LastMessageId { get; set; }
        public bool IsActive { get; set; } = true;

        // Navigation properties
        public virtual AppUser? CreatedBy { get; set; }
        public virtual Message? LastMessage { get; set; }
        public virtual ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
        public virtual ICollection<Message> Messages { get; set; } = new List<Message>();

        // Domain methods
        public void UpdateLastMessage(Message message)
        {
            LastMessageId = message.Id;
            UpdatedAt = DateTime.UtcNow;
        }

        public void SetGroupName(string name)
        {
            if (Type == ConversationType.Group)
            {
                Name = name;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void SetGroupImage(string imageUrl)
        {
            if (Type == ConversationType.Group)
            {
                GroupImageUrl = imageUrl;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void Archive()
        {
            IsActive = false;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Unarchive()
        {
            IsActive = true;
            UpdatedAt = DateTime.UtcNow;
        }

        public bool IsGroupConversation() => Type == ConversationType.Group;

        public int GetParticipantCount() => Participants.Count(p => p.IsActive);
    }
}
