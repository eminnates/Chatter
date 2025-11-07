namespace Chatter.Application.DTOs.Chat;

public class MessageDto
{
    public Guid Id { get; set; }
    public string SenderId { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Type { get; set; }
    public DateTime SentAt { get; set; }
    public Guid? ReplyToMessageId { get; set; }
    public List<MessageAttachmentDto>? Attachments { get; set; }
    public List<MessageReactionDto>? Reactions { get; set; }
}
