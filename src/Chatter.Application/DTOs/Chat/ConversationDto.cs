namespace Chatter.Application.DTOs.Chat;

public class ConversationDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string Type { get; set; } = string.Empty;
    public List<ConversationParticipantDto>? Participants { get; set; }
    public MessageDto? LastMessage { get; set; }
}
