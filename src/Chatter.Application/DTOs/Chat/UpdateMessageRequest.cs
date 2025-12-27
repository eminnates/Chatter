using System.ComponentModel.DataAnnotations;
namespace Chatter.Application.DTOs.Chat;

public class UpdateMessageRequest
{
    [Required(ErrorMessage = "Mesaj içeriği boş olamaz")]
    public string Content { get; set; } = string.Empty;
}
