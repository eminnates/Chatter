namespace Chatter.Application.DTOs.Chat;

public class UpdateMessageRequest
{
    public Guid MessageId { get; set; }
    public string Content { get; set; } = string.Empty;
}
