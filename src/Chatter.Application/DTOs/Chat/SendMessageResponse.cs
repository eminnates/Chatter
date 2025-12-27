using System;
using System.Collections.Generic;
namespace Chatter.Application.DTOs.Chat;

public class SendMessageResponse
{
    public Guid MessageId { get; set; }
    public DateTime SentAt { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Type { get; set; }
}
