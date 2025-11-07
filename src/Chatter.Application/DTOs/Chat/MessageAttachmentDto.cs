namespace Chatter.Application.DTOs.Chat;

public class MessageAttachmentDto
{
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Type { get; set; }
}
