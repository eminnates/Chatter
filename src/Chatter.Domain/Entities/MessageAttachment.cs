using Chatter.Domain.Common;
using Chatter.Domain.Enums;

namespace Chatter.Domain.Entities
{
    public class MessageAttachment : BaseEntity<Guid>
    {
        public Guid MessageId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public AttachmentType Type { get; set; }
        public long FileSize { get; set; }
        public string? MimeType { get; set; }
        public string? ThumbnailUrl { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public int? Duration { get; set; } // Video/Audio süresi (saniye)
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        // Navigation property
        public virtual Message Message { get; set; } = null!;

        // Domain methods
        public bool IsImage() => Type == AttachmentType.Image;
        
        public bool IsVideo() => Type == AttachmentType.Video;
        
        public bool IsAudio() => Type == AttachmentType.Audio;
        
        public bool IsDocument() => Type == AttachmentType.Document;

        public string GetFileSizeFormatted()
        {
            string[] sizes = { "B", "KB", "MB", "GB" };
            double len = FileSize;
            int order = 0;
            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len = len / 1024;
            }
            return $"{len:0.##} {sizes[order]}";
        }

        public string GetDurationFormatted()
        {
            if (!Duration.HasValue) return string.Empty;
            
            var timeSpan = TimeSpan.FromSeconds(Duration.Value);
            if (timeSpan.Hours > 0)
                return $"{timeSpan.Hours:D2}:{timeSpan.Minutes:D2}:{timeSpan.Seconds:D2}";
            else
                return $"{timeSpan.Minutes:D2}:{timeSpan.Seconds:D2}";
        }
    }
}
