using Chatter.Domain.Common;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class RefreshToken : BaseEntity<Guid>
    {
        public Guid UserId { get; private set; } 
        public string Token { get; private set; } = string.Empty;
        public string JwtId { get; private set; } = string.Empty;
        public bool IsUsed { get; private set; }
        public bool IsRevoked { get; private set; }
        public DateTime ExpiresAt { get; private set; }
        public string? RevokedByIp { get; private set; }
        public DateTime? RevokedAt { get; private set; }
        public string? CreatedByIp { get; private set; }
        public string? ReplacedByToken { get; private set; }

        // Navigation property
        public virtual AppUser User { get; private set; } = null!;

        // Computed properties
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
        public bool IsActive => !IsRevoked && !IsUsed && !IsExpired;

        protected RefreshToken() { }

        public RefreshToken(Guid userId, string token, string jwtId, DateTime expiresAt, string? createdByIp)
        {
            if (userId == Guid.Empty) throw new RefreshTokenException("Kullanıcı ID boş olamaz.");
            if (string.IsNullOrWhiteSpace(token)) throw new RefreshTokenException("Token boş olamaz.");
            if (string.IsNullOrWhiteSpace(jwtId)) throw new RefreshTokenException("JwtId boş olamaz.");

            UserId = userId;
            Token = token;
            JwtId = jwtId;
            ExpiresAt = expiresAt;
            CreatedByIp = createdByIp;
            IsUsed = false;
            IsRevoked = false;
        }

        // Domain methods
        public void Revoke(string? ipAddress = null)
        {
            if (!IsActive) throw new RefreshTokenException("Sadece aktif olan tokenlar iptal edilebilir.");
            
            IsRevoked = true;
            RevokedAt = DateTime.UtcNow;
            RevokedByIp = ipAddress;
            UpdatedAt = DateTime.UtcNow;
        }

        public void MarkAsUsed()
        {
            if (!IsActive) throw new RefreshTokenException("Sadece aktif olan tokenlar kullanılabilir.");

            IsUsed = true;
            UpdatedAt = DateTime.UtcNow;
        }

        public void ReplaceWith(string newToken, string? ipAddress = null)
        {
            if (!IsActive) throw new RefreshTokenException("Pasif bir token başka bir token ile değiştirilemez.");

            IsRevoked = true;
            RevokedAt = DateTime.UtcNow;
            RevokedByIp = ipAddress;
            ReplacedByToken = newToken;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}