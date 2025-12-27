using System;
using System.Collections.Generic;

namespace Chatter.Application.DTOs.Chat;

public class ConversationDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string? ImageUrl { get; set; }
    public string Type { get; set; } = string.Empty; // "OneToOne" veya "Group"
    public bool IsGroup { get; set; }
    public bool IsOnline { get; set; }
    public int UnreadCount { get; set; }
    public DateTime? LastMessageTime { get; set; }
    public List<ConversationParticipantDto>? Participants { get; set; }
    public MessageDto? LastMessage { get; set; }
}