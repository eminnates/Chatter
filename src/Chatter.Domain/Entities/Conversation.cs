using Chatter.Domain.Common;
using Chatter.Domain.Enums;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class Conversation : BaseEntity<Guid>
    {
        public string? Name { get; set; }
        public ConversationType Type { get; set; } = ConversationType.OneToOne;
        public string? GroupImageUrl { get; set; }
        // Grubu oluşturan kişi null olabilir (sistem oluşturduysa) ama varsa Guid olmalı.
        public Guid? CreatedByUserId { get; set; }     
        public Guid? LastMessageId { get; set; }
        public bool IsActive { get; set; } = true;

        // Navigation properties
        public virtual AppUser? CreatedBy { get; set; }
        public virtual Message? LastMessage { get; set; }
        public virtual ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
        public virtual ICollection<Message> Messages { get; set; } = new List<Message>();

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