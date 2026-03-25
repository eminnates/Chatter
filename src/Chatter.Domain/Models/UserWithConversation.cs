using System;
using Chatter.Domain.Entities;

namespace Chatter.Domain.Models
{
    public class UserWithConversation
    {
        public AppUser User { get; set; } = null!;
        public Guid? ConversationId { get; set; }
        public string? LastMessage { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public int UnreadCount { get; set; }
    }
}
