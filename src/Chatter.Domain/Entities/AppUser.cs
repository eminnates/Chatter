using Microsoft.AspNetCore.Identity;
using Chatter.Domain.Common;

namespace Chatter.Domain.Entities
{
    public class AppUser : IdentityUser<Guid> 
    {
        // ====== Profil Bilgileri ======
        public string FullName { get; private set; } = string.Empty;
        public string? Bio { get; private set; }
        public string? ProfilePictureUrl { get; private set; }

        // ====== Online Status ======
        public bool IsOnline { get; private set; }
        public DateTime? LastSeenAt { get; private set; }
        
        // ====== Push Notifications ======
        public string? FcmToken { get; private set; }

        // ====== Hesap Durumu ======
        public bool IsActive { get; private set; } = true;
        public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; private set; }

        // ====== Navigation Properties ======
        public virtual ICollection<RefreshToken> RefreshTokens { get; private set; } = new List<RefreshToken>();
        public virtual ICollection<Message> SentMessages { get; private set; } = new List<Message>();
        public virtual ICollection<ConversationParticipant> ConversationParticipants { get; private set; } = new List<ConversationParticipant>();
        public virtual ICollection<UserConnection> Connections { get; private set; } = new List<UserConnection>();
        public virtual ICollection<MessageReaction> Reactions { get; private set; } = new List<MessageReaction>();

        // ====== Constructors ======
        protected AppUser() { } // EF Core ve Identity için

        public AppUser(string userName, string email, string fullName) : base(userName)
        {
            Email = email;
            FullName = !string.IsNullOrWhiteSpace(fullName) ? fullName : userName;
            IsActive = true;
            IsOnline = false;
            CreatedAt = DateTime.UtcNow;
        }

        // ====== Domain Methods ======
        public void UpdateProfile(string fullName, string? bio, string? profilePictureUrl)
        {
            if (string.IsNullOrWhiteSpace(fullName))
            {
                throw new ArgumentException("Ad Soyad boş olamaz.", nameof(fullName));
            }

            FullName = fullName;
            Bio = bio;
            if (!string.IsNullOrWhiteSpace(profilePictureUrl))
            {
                ProfilePictureUrl = profilePictureUrl;
            }
            UpdatedAt = DateTime.UtcNow;
        }

        public void SetFcmToken(string? fcmToken)
        {
            FcmToken = fcmToken;
            UpdatedAt = DateTime.UtcNow;
        }

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