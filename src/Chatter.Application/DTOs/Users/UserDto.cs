namespace Chatter.Application.DTOs.Users;

public class UserDto
{
    public string Id { get; set; } = string.Empty; 
    
    public string UserName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
    public bool IsOnline { get; set; }
    public DateTime? LastSeenAt { get; set; }
    
    // İstatistik alanları
    public int UnreadCount { get; set; }
    public DateTime? LastMessageAt { get; set; }
}