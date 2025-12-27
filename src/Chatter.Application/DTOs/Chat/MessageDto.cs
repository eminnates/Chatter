using System;
using System.Collections.Generic;

namespace Chatter.Application.DTOs.Chat; // Namespace'in burası olduğundan emin ol

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Type { get; set; }
    public DateTime SentAt { get; set; }
    public bool IsRead { get; set; }
    public Guid? ReplyToMessageId { get; set; }
    public List<MessageAttachmentDto>? Attachments { get; set; } = new();
    public List<MessageReactionDto>? Reactions { get; set; }
}