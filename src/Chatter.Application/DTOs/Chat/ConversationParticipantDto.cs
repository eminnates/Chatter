namespace Chatter.Application.DTOs.Chat;

public class ConversationParticipantDto
{
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime JoinedAt { get; set; }
    public int UnreadCount { get; set; }
}
