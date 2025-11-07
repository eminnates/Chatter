using Chatter.Domain.Common;

namespace Chatter.Domain.Entities
{
    public class MessageReaction : BaseEntity<int>
    {
        public Guid MessageId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Emoji { get; set; } = string.Empty;

        // Navigation properties
        public virtual Message Message { get; set; } = null!;
        public virtual AppUser User { get; set; } = null!;

        // Domain methods
        public void ChangeEmoji(string newEmoji)
        {
            Emoji = newEmoji;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
