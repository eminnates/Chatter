using Chatter.Domain.Common;

namespace Chatter.Domain.Entities
{
    // DEĞİŞİKLİK 1: BaseEntity<int> -> BaseEntity<Guid>
    // Tablonun kendi ID'si standartlara uygun olarak Guid oldu.
    public class MessageReaction : BaseEntity<Guid>
    {
        public Guid MessageId { get; set; }
        
        // DEĞİŞİKLİK 2: string UserId -> Guid UserId
        // AppUser ile ilişkinin kurulabilmesi için tipler eşleşmeli.
        public Guid UserId { get; set; } 
        
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