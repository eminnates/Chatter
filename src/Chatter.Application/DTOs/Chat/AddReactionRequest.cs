using System.ComponentModel.DataAnnotations;
namespace Chatter.Application.DTOs.Chat;

public class AddReactionRequest
{
    [Required(ErrorMessage = "Emoji boş olamaz")]
    public string Emoji { get; set; } = string.Empty;
}
