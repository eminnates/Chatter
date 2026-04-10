using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class Conversation : BaseEntity<Guid>
    {
        public string? Name { get; private set; }
        public ConversationType Type { get; private set; } = ConversationType.OneToOne;
        public string? GroupImageUrl { get; private set; }
        // Grubu oluşturan kişi null olabilir (sistem oluşturduysa) ama varsa Guid olmalı.
        public Guid? CreatedByUserId { get; private set; }     
        public Guid? LastMessageId { get; private set; }
        public bool IsActive { get; private set; } = true;

        // Navigation properties
        public virtual AppUser? CreatedBy { get; private set; }
        public virtual Message? LastMessage { get; private set; }
        public virtual ICollection<ConversationParticipant> Participants { get; private set; } = new List<ConversationParticipant>();
        public virtual ICollection<Message> Messages { get; private set; } = new List<Message>();

        // EF Core için parametresiz constructor
        protected Conversation() { }

        public Conversation(ConversationType type, string? name = null, string? groupImageUrl = null, Guid? createdByUserId = null)
        {
            Type = type;
            Name = name;
            GroupImageUrl = groupImageUrl;
            CreatedByUserId = createdByUserId;
            IsActive = true;
        }

        public void AddParticipant(ConversationParticipant participant)
        {
            if (participant == null)
            {
                throw new ArgumentNullException(nameof(participant));
            }

            if (Participants.Any(p => p.UserId == participant.UserId))
            {
                throw new ConversationException("Bu kullanıcı zaten sohbete eklenmiş.");
            }

            if (Type == ConversationType.OneToOne && Participants.Count >= 2)
            {
                throw new ConversationException("Birebir (One-to-One) sohbetlere sadece iki kişi eklenebilir.");
            }

            Participants.Add(participant);
        }

        // Domain methods
        public void UpdateLastMessage(Message message)
        {
            LastMessageId = message.Id;
            UpdatedAt = DateTime.UtcNow;
        }

        public void SetGroupName(string name)
        {
            if (Type == ConversationType.Group)
            {
                Name = name;
                UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                throw new ConversationException("Birebir (One-to-One) sohbetlerin ortak bir ismi olamaz. Sadece grup sohbetlerinin ismi değiştirilebilir.");
            }
        }

        public void SetGroupImage(string imageUrl)
        {
            if (Type == ConversationType.Group)
            {
                GroupImageUrl = imageUrl;
                UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                throw new ConversationException("Birebir (One-to-One) sohbetlerin ortak bir resmi olamaz. Sadece grup sohbetlerine resim eklenebilir.");
            }
        }

        public void Archive()
        {
            if (LastMessageId.HasValue) 
            {
                IsActive = false;
                UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                throw new ConversationException("İçerisinde hiç mesaj bulunmayan bir sohbet arşivlendi (archive) olarak işaretlenemez.");
            }
        }

        public void Unarchive()
        {
            if (!IsActive)
            {
                IsActive = true;
                UpdatedAt = DateTime.UtcNow;
            }
        }

        public bool IsGroupConversation() => Type == ConversationType.Group;
    }
}