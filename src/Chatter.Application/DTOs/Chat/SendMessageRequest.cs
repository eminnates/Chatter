using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Chatter.Application.DTOs.Chat;

public class SendMessageRequest
{
    [JsonPropertyName("conversationId")]
    public Guid? ConversationId { get; set; }
    
    [JsonPropertyName("receiverId")]
    public string? ReceiverId { get; set; }
    
    [Required(ErrorMessage = "Message content is required")]
    [StringLength(5000, MinimumLength = 1, ErrorMessage = "Message must be between 1 and 5000 characters")]
    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
    
    [StringLength(50, ErrorMessage = "Message type cannot exceed 50 characters")]
    [JsonPropertyName("type")]
    public string? Type { get; set; }
    
    [JsonPropertyName("replyToMessageId")]
    public string? ReplyToMessageId { get; set; }
}
