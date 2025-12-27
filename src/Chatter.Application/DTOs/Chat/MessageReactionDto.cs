using System;
using System.Collections.Generic;
namespace Chatter.Application.DTOs.Chat;

public class MessageReactionDto
{
    public Guid UserId { get; set; } // string -> Guid
    public string Emoji { get; set; } = string.Empty;
}
