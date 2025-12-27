using Microsoft.AspNetCore.Identity;
using Chatter.Domain.Common;

namespace Chatter.Domain.Entities
{
    // DEĞİŞİKLİK BURADA: <Guid> ekledik.
    public class AppUser : IdentityUser<Guid> 
    {
        // ====== Profil Bilgileri ======
        public string FullName { get; set; } = string.Empty;
        public string? Bio { get; set; }
        public string? ProfilePictureUrl { get; set; }

        // ====== Online Status ======
        public bool IsOnline { get; set; }
        public DateTime? LastSeenAt { get; set; }

        // ====== Hesap Durumu ======
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // ====== Navigation Properties ======
        public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
        public virtual ICollection<Message> SentMessages { get; set; } = new List<Message>();
        public virtual ICollection<ConversationParticipant> ConversationParticipants { get; set; } = new List<ConversationParticipant>();
        public virtual ICollection<UserConnection> Connections { get; set; } = new List<UserConnection>();
        public virtual ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();

        // ====== Domain Methods ======
        public void UpdateLastSeen()
        {
            LastSeenAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void SetOnlineStatus(bool isOnline)
        {
            IsOnline = isOnline;
            if (isOnline)
            {
                LastSeenAt = DateTime.UtcNow;
            }
            UpdatedAt = DateTime.UtcNow;
        }

        public void Deactivate()
        {
            IsActive = false;
            IsOnline = false;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Activate()
        {
            IsActive = true;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}