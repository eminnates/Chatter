using Chatter.Domain.Common;
using Chatter.Domain.Enums;

namespace Chatter.Domain.Entities
{
    // DEĞİŞİKLİK 1: BaseEntity<int> -> BaseEntity<Guid>
    // Tablonun kendi ID'si de artık Guid olacak.
    public class ConversationParticipant : BaseEntity<Guid>
    {
        public Guid ConversationId { get; set; }
        
        // DEĞİŞİKLİK 2: string UserId -> Guid UserId
        // AppUser ile ilişkinin kurulabilmesi için tipler eşleşmeli.
        public Guid UserId { get; set; }
        
        public ParticipantRole Role { get; set; } = ParticipantRole.Member;
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LeftAt { get; set; }
        public bool IsActive { get; set; } = true;
        public bool IsMuted { get; set; }
        public DateTime? LastReadAt { get; set; }
        public int UnreadCount { get; set; }

        // Navigation properties
        public virtual Conversation Conversation { get; set; } = null!;
        public virtual AppUser User { get; set; } = null!;

        // Domain methods
        public void Leave()
        {
            IsActive = false;
            LeftAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Rejoin()
        {
            IsActive = true;
            LeftAt = null;
            JoinedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void MarkAsRead(DateTime readAt)
        {
            LastReadAt = readAt;
            UnreadCount = 0;
            UpdatedAt = DateTime.UtcNow;
        }

        public void IncrementUnreadCount()
        {
            UnreadCount++;
            UpdatedAt = DateTime.UtcNow;
        }

        public void ToggleMute()
        {
            IsMuted = !IsMuted;
            UpdatedAt = DateTime.UtcNow;
        }

        public void PromoteToAdmin()
        {
            Role = ParticipantRole.Admin;
            UpdatedAt = DateTime.UtcNow;
        }

        public void DemoteToMember()
        {
            Role = ParticipantRole.Member;
            UpdatedAt = DateTime.UtcNow;
        }

        public void MakeOwner()
        {
            Role = ParticipantRole.Owner;
            UpdatedAt = DateTime.UtcNow;
        }

        public bool IsOwner() => Role == ParticipantRole.Owner;
        public bool IsAdmin() => Role == ParticipantRole.Admin;
        public bool CanManageGroup() => Role == ParticipantRole.Owner || Role == ParticipantRole.Admin;
    }
}