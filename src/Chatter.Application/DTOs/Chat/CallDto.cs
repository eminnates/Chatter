using Chatter.Domain.Enums;

namespace Chatter.Application.DTOs.Chat
{
    public class CallDto
    {
        public Guid Id { get; set; }
        public Guid ConversationId { get; set; }
        public Guid InitiatorId { get; set; }
        public string InitiatorUsername { get; set; } = string.Empty;
        public string InitiatorFullName { get; set; } = string.Empty;
        public CallType Type { get; set; }
        public CallStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int? DurationInSeconds { get; set; }
        public List<Guid> ParticipantIds { get; set; } = new();
    }
}
