using Chatter.Application.Common; // Result<T> ve Error sınıflarının olduğu yer
using Microsoft.AspNetCore.Mvc;

namespace Chatter.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BaseApiController : ControllerBase
{
    // Result nesnesini HTTP yanıtına (IActionResult) çeviren yardımcı metod
    protected IActionResult HandleResult<T>(Result<T> result)
    {
        // 1. İşlem Başarılıysa
        if (result.IsSuccess)
        {
            // Eğer veri varsa veriyi dön, yoksa sadece 200 OK dön
            if (result.Value != null)
                return Ok(result.Value);
                
            return Ok();
        }

        // 2. İşlem Başarısızsa (Hata Yönetimi)
        // Hata koduna göre özelleştirilmiş HTTP kodları dönebilirsin
        if (result.Error != null)
        {
            // Eğer hata kodu "NotFound" içeriyorsa 404 dön (Opsiyonel Geliştirme)
            if (result.Error.Code.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
            {
                return NotFound(new { error = result.Error });
            }
        }

        // Varsayılan hata dönüşü: 400 Bad Request
        return BadRequest(new { error = result.Error });
    }
}