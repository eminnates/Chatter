using Chatter.Domain.Common;

namespace Chatter.Domain.Entities
{
    public class RefreshToken : BaseEntity<int>
    {
        public string UserId { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string JwtId { get; set; } = string.Empty;
        public bool IsUsed { get; set; }
        public bool IsRevoked { get; set; }
        public DateTime ExpiresAt { get; set; }
        public string? RevokedByIp { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string? CreatedByIp { get; set; }
        public string? ReplacedByToken { get; set; }

        // Navigation property
        public virtual AppUser User { get; set; } = null!;

        // Computed properties
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
        public bool IsActive => !IsRevoked && !IsUsed && !IsExpired;

        // Domain methods
        public void Revoke(string? ipAddress = null)
        {
            IsRevoked = true;
            RevokedAt = DateTime.UtcNow;
            RevokedByIp = ipAddress;
            UpdatedAt = DateTime.UtcNow;
        }

        public void MarkAsUsed()
        {
            IsUsed = true;
            UpdatedAt = DateTime.UtcNow;
        }

        public void ReplaceWith(string newToken, string? ipAddress = null)
        {
            IsRevoked = true;
            RevokedAt = DateTime.UtcNow;
            RevokedByIp = ipAddress;
            ReplacedByToken = newToken;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
