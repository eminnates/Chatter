using Chatter.Application.Common;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Frozen;

namespace Chatter.API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class FilesController : BaseApiController
{
    private readonly IWebHostEnvironment _env;
    
    // O(1) hızında, allocate etmeyen yapı (OrdinalIgnoreCase ile ToLowerInvariant'tan kurtuluruz)
    private static readonly FrozenSet<string> _allowedExtensions = new[] 
    { 
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".docx", ".zip", ".mp3", ".mp4", ".mov", ".webm", ".avi" 
    }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    // Maksimum dosya boyutu (50MB - video desteği için)
    private const long MaxFileSize = 50 * 1024 * 1024;

    public FilesController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(50 * 1024 * 1024)] // 50MB
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

            // 3. Uzantı kontrolü (ToLowerInvariant kaldırıldı, yeni string tahsis edilmiyor)
            var extension = Path.GetExtension(file.FileName);
            if (!_allowedExtensions.Contains(extension ?? string.Empty))
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

            // 7. Dönecek veri objesini hazırla - /api/files/ formatında
            var fileData = new
            {
                Url = $"/api/files/{uniqueFileName}",
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

    // Serve files from /api/files/{fileName}
    [HttpGet("{fileName}")]
    public IActionResult GetFile(string fileName)
    {
        return ServeFile(fileName);
    }
    
    // Also serve files from /uploads/{fileName} for backward compatibility with old database records
    [HttpGet("/uploads/{fileName}")]
    public IActionResult GetFileFromUploads(string fileName)
    {
        return ServeFile(fileName);
    }
    
    private IActionResult ServeFile(string fileName)
    {
        try
        {
            // Güvenlik: Span kullanarak string allocation olmadan (Zero-Allocation) path traversal kontrolü
            ReadOnlySpan<char> fileNameSpan = fileName.AsSpan();
            if (fileNameSpan.Contains("..", StringComparison.Ordinal) || 
                fileNameSpan.IndexOfAny('/', '\\') >= 0)
            {
                return BadRequest("Geçersiz dosya adı.");
            }

            var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var filePath = Path.Combine(webRootPath, "uploads", fileName);

            if (!System.IO.File.Exists(filePath))
            {
                return NotFound("Dosya bulunamadı.");
            }

            // MIME type belirle (string yerine tahsisatsız ReadOnlySpan kullanıldı)
            ReadOnlySpan<char> extension = Path.GetExtension(fileNameSpan);
            var contentType = GetContentType(extension);

            // CORS headers for cross-origin image loading
            Response.Headers.Append("Access-Control-Allow-Origin", "*");
            Response.Headers.Append("Access-Control-Allow-Methods", "GET");
            Response.Headers.Append("Cache-Control", "public, max-age=31536000");

            // KRİTİK PERFORMANS İYİLEŞTİRMESİ:
            // Kötü Kod: System.IO.File.ReadAllBytes(filePath); 50MB dosyayı belleğe yükleyip GC'yi patlatıyordu.
            // İyi Kod: İşletim sistemi seviyesinde "Zero-Copy" / "Stream" ile byte'ları ağdan doğrudan gönder.
            return PhysicalFile(filePath, contentType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Dosya okunurken hata: {ex.Message}");
        }
    }

    // Allocation (bellek sarfiyatı) yapmadan uzantıya bakıp ContentType dönen yardımcı metot
    private static string GetContentType(ReadOnlySpan<char> extension)
    {
        if (extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) || 
            extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase)) return "image/jpeg";
        if (extension.Equals(".png", StringComparison.OrdinalIgnoreCase)) return "image/png";
        if (extension.Equals(".gif", StringComparison.OrdinalIgnoreCase)) return "image/gif";
        if (extension.Equals(".webp", StringComparison.OrdinalIgnoreCase)) return "image/webp";
        if (extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase)) return "application/pdf";
        if (extension.Equals(".docx", StringComparison.OrdinalIgnoreCase)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (extension.Equals(".zip", StringComparison.OrdinalIgnoreCase)) return "application/zip";
        if (extension.Equals(".mp3", StringComparison.OrdinalIgnoreCase)) return "audio/mpeg";
        if (extension.Equals(".mp4", StringComparison.OrdinalIgnoreCase)) return "video/mp4";
        if (extension.Equals(".mov", StringComparison.OrdinalIgnoreCase)) return "video/quicktime";
        if (extension.Equals(".webm", StringComparison.OrdinalIgnoreCase)) return "video/webm";
        if (extension.Equals(".avi", StringComparison.OrdinalIgnoreCase)) return "video/x-msvideo";
        
        return "application/octet-stream";
    }
}