namespace Chatter.Application.DTOs.Chat;

public class SendMessageRequest
{
    public Guid ConversationId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Type { get; set; }
    public Guid? ReplyToMessageId { get; set; }
}
