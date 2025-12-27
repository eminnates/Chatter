using Chatter.Domain.Enums;

namespace Chatter.Application.DTOs.Chat;

public class SendMessageRequest
{
    public Guid? ReceiverId { get; set; }
    public Guid? ConversationId { get; set; }
    public string? Content { get; set; }
    public MessageType Type { get; set; } = MessageType.Text;
    
    // Hata CS1061'i çözer:
    public Guid? ReplyToMessageId { get; set; }

    // Attachment hatalarını çözer:
    public AttachmentRequest? Attachment { get; set; }
}