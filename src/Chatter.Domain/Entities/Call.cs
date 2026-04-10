using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class Call : BaseEntity<Guid>
    {
        public Guid ConversationId { get; private set; }
        public Guid InitiatorId { get; private set; }
        public CallType Type { get; private set; }
        public CallStatus Status { get; private set; } = CallStatus.Ringing;
        public DateTime? StartedAt { get; private set; }
        public DateTime? EndedAt { get; private set; }
        public int? DurationInSeconds { get; private set; }

        // Navigation properties
        public virtual Conversation Conversation { get; private set; } = null!;
        public virtual AppUser Initiator { get; private set; } = null!;

        // EF Core için parametresiz constructor
        protected Call() { }

        public Call(Guid conversationId, Guid initiatorId, CallType type)
        {
            if (conversationId == Guid.Empty) throw new CallException("Geçerli bir sohbet kimliği (ConversationId) gereklidir.");
            if (initiatorId == Guid.Empty) throw new CallException("Geçerli bir arayan kişi (InitiatorId) gereklidir.");

            ConversationId = conversationId;
            InitiatorId = initiatorId;
            Type = type;
            Status = CallStatus.Ringing;
        }

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

        public void SetInitiator(AppUser initiator)
        {
            Initiator = initiator ?? throw new CallException("Arayan kişi (Initiator) bilgisi boş olamaz.");
        }
    }
}
