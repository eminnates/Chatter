using Chatter.Application.Common;
using Microsoft.AspNetCore.Mvc;

namespace Chatter.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class FilesController : BaseApiController
{
    private readonly IWebHostEnvironment _env;
    // İzin verilen dosya uzantıları (Güvenlik için)
    private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".docx", ".zip", ".mp3", ".mp4" };
    // Maksimum dosya boyutu (Örn: 10MB)
    private const long MaxFileSize = 10 * 1024 * 1024;

    public FilesController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        try
        {
            // 1. Dosya varlık kontrolü
            if (file == null || file.Length == 0)
            {
                return HandleResult(Result<object>.Failure(new Error("File.Empty", "Dosya seçilmedi veya geçersiz.")));
            }

            // 2. Boyut kontrolü
            if (file.Length > MaxFileSize)
            {
                return HandleResult(Result<object>.Failure(new Error("File.TooLarge", "Dosya boyutu 10MB sınırını aşamaz.")));
            }

            // 3. Uzantı kontrolü
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(extension))
            {
                return HandleResult(Result<object>.Failure(new Error("File.InvalidType", "Bu dosya türünün yüklenmesine izin verilmiyor.")));
            }

            // 4. Klasör yolu hazırlığı (wwwroot/uploads)
            var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadsFolder = Path.Combine(webRootPath, "uploads");

            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            // 5. Benzersiz dosya adı oluşturma
            var fileName = Path.GetFileName(file.FileName);
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            // 6. Dosyayı diske kaydetme
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // 7. Dönecek veri objesini hazırla
            var fileData = new
            {
                Url = $"/uploads/{uniqueFileName}",
                FileName = fileName,
                FileSize = file.Length,
                ContentType = file.ContentType
            };

            // BaseApiController'daki HandleResult metodunu kullanarak başarılı sonuç dön
            return HandleResult(Result<object>.Success(fileData));
        }
        catch (Exception ex)
        {
            // Beklenmedik hataları yakala
            return HandleResult(Result<object>.Failure(new Error("File.UploadException", $"Dosya yüklenirken hata oluştu: {ex.Message}")));
        }
    }
}