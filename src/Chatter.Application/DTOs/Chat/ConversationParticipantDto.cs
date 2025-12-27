using System;
using System.Collections.Generic;
namespace Chatter.Application.DTOs.Chat;

public class ConversationParticipantDto
{
    public Guid UserId { get; set; } // string -> Guid
    public string Role { get; set; } = string.Empty; // "Admin", "Member"
    public DateTime JoinedAt { get; set; }
    public int UnreadCount { get; set; }
}