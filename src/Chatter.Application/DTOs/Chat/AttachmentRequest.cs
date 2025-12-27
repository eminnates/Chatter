using Chatter.Domain.Enums;

namespace Chatter.Application.DTOs.Chat;

public class AttachmentRequest
{
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? MimeType { get; set; }
    // MessageAttachment.Type (AttachmentType Enum) için:
    public int Type { get; set; } 
}