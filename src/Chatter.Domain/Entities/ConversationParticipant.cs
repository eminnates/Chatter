using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class ConversationParticipant : BaseEntity<Guid>
    {
        public Guid ConversationId { get; private set; }
        public Guid UserId { get; private set; }
        public ParticipantRole Role { get; private set; } = ParticipantRole.Member;
        public DateTime JoinedAt { get; private set; } = DateTime.UtcNow;
        public DateTime? LeftAt { get; private set; }
        public bool IsActive { get; private set; } = true;
        public bool IsMuted { get; private set; }
        public DateTime? LastReadAt { get; private set; }
        public int UnreadCount { get; private set; }

        // Navigation properties
        public virtual Conversation Conversation { get; private set; } = null!;
        public virtual AppUser User { get; private set; } = null!;

        // EF Core için parametresiz constructor
        protected ConversationParticipant() { }

        public ConversationParticipant(Guid conversationId, Guid userId, ParticipantRole role = ParticipantRole.Member)
        {
            if (conversationId == Guid.Empty) throw new ConversationException("ConversationParticipant oluşturmak için geçerli bir ConversationId gereklidir.");
            if (userId == Guid.Empty) throw new ConversationException("ConversationParticipant oluşturmak için geçerli bir UserId gereklidir.");

            ConversationId = conversationId;
            UserId = userId;
            Role = role;
            JoinedAt = DateTime.UtcNow;
            IsActive = true;
            IsMuted = false;
            UnreadCount = 0;
        }

        // Domain methods
        public void Leave()
        {
            if (!IsActive)
            {
                throw new ConversationException("Grupta zaten aktif olmayan bir katılımcı gruptan ayrılamaz.");
            }

            if (IsOwner())
            {
                throw new ConversationException("Grubun kurucusu (Owner) gruptan doğrudan ayrılamaz. Önce yetkisini devretmeli veya grubu kapatmalıdır.");
            }
            
            // Eğer aktifse ve kurucu değilse ayrılabilir:
            IsActive = false;
            LeftAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Rejoin()
        {
            if (!IsActive)
            {
                IsActive = true;
                LeftAt = null;
                JoinedAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                throw new ConversationException("Grupta zaten olan birisi gruba tekrar giremez.");
            }
        }

        public void MarkAsRead(DateTime readAt)
        {
            if (!IsActive)
            {
                throw new ConversationException("Sohbette aktif olmayan biri mesajları 'okundu' yapamaz.");
            }

            if (UnreadCount == 0)
            {
                return;
            }

            LastReadAt = readAt;
            UnreadCount = 0;
            UpdatedAt = DateTime.UtcNow;
        }

        public void IncrementUnreadCount()
        {
            if (!IsActive)
            {
                throw new ConversationException("Sohbette aktif olmayan biri 'okunmamış' mesaj alamaz.");
            }
            if (UnreadCount < 99)
            {
                UnreadCount++;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void ToggleMute()
        {
            if (!IsActive)
            {
                throw new ConversationException("Sohbette aktif olmayan biri sohbeti sessize alamaz veya sesini açamaz.");
            }

            IsMuted = !IsMuted;
            UpdatedAt = DateTime.UtcNow;
        }

        public void PromoteToAdmin()
        {
            if (!IsActive)
            {
                throw new ConversationException("Grupta aktif olmayan bir katılımcı yönetici (Admin) yapılamaz.");
            }

            if (Role == ParticipantRole.Owner)
            {
                throw new ConversationException("Grubun kurucusu (Owner) halihazırda en yüksek yetkiye sahiptir, yönetici statüsüne çekilemez.");
            }

            if (Role == ParticipantRole.Admin)
            {
                return;
            }

            Role = ParticipantRole.Admin;
            UpdatedAt = DateTime.UtcNow;
        }

        public void DemoteToMember()
        {
            if (!IsActive)
            {
                throw new ConversationException("Grupta aktif olmayan bir katılımcının yetkisi değiştirilemez.");
            }

            if (Role == ParticipantRole.Owner)
            {
                throw new ConversationException("Grubun kurucusu (Owner) doğrudan normal üyeye (Member) düşürülemez. Önce kuruculuk yetkisini devretmelidir.");
            }

            if (Role == ParticipantRole.Member)
            {
                return;
            }

            Role = ParticipantRole.Member;
            UpdatedAt = DateTime.UtcNow;
        }

        public void MakeOwner()
        {
            if (!IsActive)
            {
                throw new ConversationException("Grupta aktif olmayan bir katılımcıya kurucu (Owner) yetkisi devredilemez.");
            }

            if (Role == ParticipantRole.Owner)
            {
                return;
            }

            Role = ParticipantRole.Owner;
            UpdatedAt = DateTime.UtcNow;
        }

        public bool IsOwner() => Role == ParticipantRole.Owner;
        public bool IsAdmin() => Role == ParticipantRole.Admin;
        public bool CanManageGroup() => Role == ParticipantRole.Owner || Role == ParticipantRole.Admin;
    }
}