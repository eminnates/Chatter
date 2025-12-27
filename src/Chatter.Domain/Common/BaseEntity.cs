using Microsoft.AspNetCore.Identity;

namespace Chatter.Domain.Common
{
    public abstract class BaseEntity<TKey>
    {
        // Değişiklik: = default!; ekledik.
        public TKey Id { get; set; } = default!; 
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}