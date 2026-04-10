using Chatter.Domain.Enums;

namespace Chatter.Application.DTOs.Chat;

public class AttachmentRequest
{
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? MimeType { get; set; }
    public int Type { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public int? Duration { get; set; } // Video/Audio süresi için saniye
}