using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

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
            else 
            {
                throw new CallException($"Çağrı kabul edilemedi. Çünkü çağrının mevcut durumu '{Status}', ancak sadece 'Ringing' (Çalıyor) durumundaki çağrılar kabul edilebilir.");
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
            else 
            {
                throw new CallException($"Çağrı reddedilemedi. Çünkü çağrının mevcut durumu '{Status}', ancak sadece 'Ringing' (Çalıyor) durumundaki çağrılar reddedilebilir.");
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
            else
            {
                throw new CallException($"Çağrı cevapsız (missed) olarak işaretlenemedi. Çünkü çağrının mevcut durumu '{Status}', ancak sadece 'Ringing' (Çalıyor) durumundaki çağrılar bu duruma çekilebilir.");
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
            else
            {
                throw new CallException($"Çağrı bitirilemedi. Çünkü çağrının mevcut durumu '{Status}', ancak sadece 'Ringing' (Çalıyor) veya 'Active' (Konuşmada) durumundaki çağrılar bitirilebilir.");
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
