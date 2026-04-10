using Chatter.Domain.Common;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class UserConnection : BaseEntity<Guid>
    {
        public Guid UserId { get; private set; }
        public string ConnectionId { get; private set; } = string.Empty;
        public string? UserAgent { get; private set; }
        public string? IpAddress { get; private set; }
        public DateTime ConnectedAt { get; private set; } = DateTime.UtcNow;
        public DateTime? DisconnectedAt { get; private set; }
        public bool IsActive { get; private set; } = true;

        // Navigation property
        public virtual AppUser User { get; private set; } = null!;

        protected UserConnection() { }

        public UserConnection(Guid userId, string connectionId, string? userAgent, string? ipAddress)
        {
            if (userId == Guid.Empty) throw new UserConnectionException("Kullanıcı ID boş olamaz.");
            if (string.IsNullOrWhiteSpace(connectionId)) throw new UserConnectionException("Bağlantı ID boş olamaz.");

            UserId = userId;
            ConnectionId = connectionId;
            UserAgent = userAgent;
            IpAddress = ipAddress;
            ConnectedAt = DateTime.UtcNow;
            IsActive = true;
        }

        // Domain methods
        public void Disconnect()
        {
            IsActive = false;
            DisconnectedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public void Reconnect(string newConnectionId)
        {
            ConnectionId = newConnectionId;
            IsActive = true;
            DisconnectedAt = null;
            ConnectedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }

        public TimeSpan? GetConnectionDuration()
        {
            if (DisconnectedAt.HasValue)
            {
                return DisconnectedAt.Value - ConnectedAt;
            }
            return DateTime.UtcNow - ConnectedAt;
        }
    }
}