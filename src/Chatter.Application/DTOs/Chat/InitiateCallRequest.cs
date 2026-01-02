using Chatter.Domain.Enums;

namespace Chatter.Application.DTOs.Chat
{
    public class InitiateCallRequest
    {
        public Guid ReceiverId { get; set; }
        public CallType Type { get; set; }
    }
}
