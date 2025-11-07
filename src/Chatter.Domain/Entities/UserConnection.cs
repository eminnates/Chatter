using Chatter.Domain.Common;

namespace Chatter.Domain.Entities
{
    public class UserConnection : BaseEntity<int>
    {
        public string UserId { get; set; } = string.Empty;
        public string ConnectionId { get; set; } = string.Empty;
        public string? UserAgent { get; set; }
        public string? IpAddress { get; set; }
        public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
        public DateTime? DisconnectedAt { get; set; }
        public bool IsActive { get; set; } = true;

        // Navigation property
        public virtual AppUser User { get; set; } = null!;

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
