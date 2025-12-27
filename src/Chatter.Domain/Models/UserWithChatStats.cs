using Chatter.Domain.Entities;

namespace Chatter.Domain.Models
{
    public class UserWithChatStats
    {
        public AppUser User { get; set; } = null!;
        public int UnreadCount { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }
}