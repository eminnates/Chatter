using Chatter.Domain.Common;
using Chatter.Domain.Enums;

namespace Chatter.Domain.Entities
{
    public class Call : BaseEntity<Guid>
    {
        public Guid ConversationId { get; set; }
        public Guid InitiatorId { get; set; }
        public CallType Type { get; set; }
        public CallStatus Status { get; set; } = CallStatus.Ringing;
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int? DurationInSeconds { get; set; }

        // Navigation properties
        public virtual Conversation Conversation { get; set; } = null!;
        public virtual AppUser Initiator { get; set; } = null!;

        // Domain methods
        public void Accept()
        {
            if (Status == CallStatus.Ringing)
            {
                Status = CallStatus.Active;
                StartedAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void Decline()
        {
            if (Status == CallStatus.Ringing)
            {
                Status = CallStatus.Declined;
                EndedAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void MarkAsMissed()
        {
            if (Status == CallStatus.Ringing)
            {
                Status = CallStatus.Missed;
                EndedAt = DateTime.UtcNow;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void End()
        {
            if (Status == CallStatus.Active || Status == CallStatus.Ringing)
            {
                Status = CallStatus.Ended;
                EndedAt = DateTime.UtcNow;
                
                if (StartedAt.HasValue)
                {
                    DurationInSeconds = (int)(EndedAt.Value - StartedAt.Value).TotalSeconds;
                }
                
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public void MarkAsFailed()
        {
            Status = CallStatus.Failed;
            EndedAt = DateTime.UtcNow;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
