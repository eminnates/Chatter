namespace Chatter.Application.DTOs.Chat;

public class CreateConversationRequest
{
    public string? Name { get; set; }
    public string Type { get; set; } = string.Empty;
    public List<string> ParticipantIds { get; set; } = new();
}
