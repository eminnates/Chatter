using System;
using System.Collections.Generic;
namespace Chatter.Application.DTOs.Chat;

public class MessageAttachmentDto
{
    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string? Type { get; set; }
    
    public string? FileSizeFormatted { get; set; }
    public string? DurationFormatted { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
}
