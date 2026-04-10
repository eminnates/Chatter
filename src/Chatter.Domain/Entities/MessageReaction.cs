using Chatter.Domain.Common;
using Chatter.Domain.Common.Exceptions;

namespace Chatter.Domain.Entities
{
    public class MessageReaction : BaseEntity<Guid>
    {
        public Guid MessageId { get; private set; }
        public Guid UserId { get; private set; } 
        public string Emoji { get; private set; }

        public virtual Message Message { get; private set; } = null!;
        public virtual AppUser User { get; private set; } = null!;

        protected MessageReaction() { }

        public MessageReaction(Guid messageId, Guid userId, string emoji)
        {
            if (messageId == Guid.Empty) throw new MessageReactionException("Mesaj ID boş olamaz.");
            if (userId == Guid.Empty) throw new MessageReactionException("Kullanıcı ID boş olamaz.");
            if (string.IsNullOrWhiteSpace(emoji)) throw new MessageReactionException("Emoji boş olamaz.");

            MessageId = messageId;
            UserId = userId;
            Emoji = emoji;
        }

        public void ChangeEmoji(string newEmoji)
        {
            if (string.IsNullOrWhiteSpace(newEmoji)) 
                throw new MessageReactionException("Yeni emoji boş olamaz.");
                
            if (Emoji == newEmoji) 
                return;

            Emoji = newEmoji;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}