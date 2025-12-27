using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Chatter.Application.DTOs.Chat;

public class SendMessageRequest
{
    [JsonPropertyName("conversationId")]
    public Guid? ConversationId { get; set; }
    
    [JsonPropertyName("receiverId")]
    public Guid? ReceiverId { get; set; } // string -> Guid?
    
    [Required(ErrorMessage = "Mesaj içeriği boş olamaz")]
    [StringLength(5000, MinimumLength = 1, ErrorMessage = "Mesaj 1-5000 karakter arasında olmalıdır")]
    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;
    
    [JsonPropertyName("type")]
    public string? Type { get; set; } = "Text";
    
    [JsonPropertyName("replyToMessageId")]
    public Guid? ReplyToMessageId { get; set; } // string -> Guid?
}