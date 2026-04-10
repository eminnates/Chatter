using Chatter.Domain.Common;
using Chatter.Domain.Common.Exceptions;
using Chatter.Domain.Enums;

namespace Chatter.Domain.Entities
{
    public class MessageAttachment : BaseEntity<Guid>
    {
        public Guid MessageId { get; private set; }
        public string FileName { get; private set; } = string.Empty;
        public string FileUrl { get; private set; } = string.Empty;
        public AttachmentType Type { get; private set; }
        public long FileSize { get; private set; }
        public string? MimeType { get; private set; }
        public string? ThumbnailUrl { get; private set; }
        public int? Width { get; private set; }
        public int? Height { get; private set; }
        public int? Duration { get; private set; } // Video/Audio süresi (saniye)
        public DateTime UploadedAt { get; private set; } = DateTime.UtcNow;

        // Navigation property
        public virtual Message Message { get; private set; } = null!;

        // EF Core için parametresiz constructor
        protected MessageAttachment() { }

        public MessageAttachment(Guid messageId, string fileName, string fileUrl, AttachmentType type, string? thumbnailUrl = null)
        {
            if (messageId == Guid.Empty) throw new MessageAttachmentException("MessageId boş (Guid.Empty) olamaz.");
            if (string.IsNullOrWhiteSpace(fileName)) throw new MessageAttachmentException("Dosya adı boş olamaz.");
            if (string.IsNullOrWhiteSpace(fileUrl)) throw new MessageAttachmentException("Dosya adresi (URL) boş olamaz.");

            MessageId = messageId;
            FileName = fileName;
            FileUrl = fileUrl;
            Type = type;
            ThumbnailUrl = thumbnailUrl;
            UploadedAt = DateTime.UtcNow;
        }

        // Domain methods
        public bool IsImage() => Type == AttachmentType.Image;
        
        public bool IsVideo() => Type == AttachmentType.Video;
        
        public bool IsAudio() => Type == AttachmentType.Audio;
        
        public bool IsDocument() => Type == AttachmentType.Document;

        public void SetMetadata(long fileSize, string? mimeType, int? width, int? height, int? duration)
        {
            if (IsDocument() && (duration.HasValue || width.HasValue || height.HasValue))
                throw new MessageAttachmentException("Belge formalarındaki eklerin süre veya çözünürlük bilgisi olamaz.");

            if (IsAudio() && (width.HasValue || height.HasValue))
                throw new MessageAttachmentException("Ses dosyalarının çözünürlük bilgisi olamaz.");

            FileSize = fileSize;
            MimeType = mimeType;
            Width = width;
            Height = height;
            Duration = duration;
        }
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