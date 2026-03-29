using Chatter.Application.Common; // Result sınıfının olduğu namespace
using Chatter.Application.DTOs.Chat;

namespace Chatter.Application.Services;

public interface IChatService
{
    // 1. Mesaj Gönderme:
    // ServiceResponse yerine Result kullanıyoruz.
    // string senderId yerine Guid senderId (Veritabanı yapınla uyumlu olması için)
    Task<Result<MessageDto>> SendMessageAsync(SendMessageRequest request, Guid senderId);
    
    // 2. Mesajları Getirme:
    // Hata yönetimi için Result içine alıyoruz.
    Task<Result<IEnumerable<MessageDto>>> GetConversationMessagesAsync(Guid conversationId, int pageNumber, int pageSize, Guid userId);
    
    // 3. Sohbetleri Listeleme:
    Task<Result<IEnumerable<ConversationDto>>> GetUserConversationsAsync(Guid userId);
    
    // 4. Okundu İşaretleme:
    // İşlem başarılı mı başarısız mı görmek için Result<bool>
    Task<Result<bool>> MarkMessagesAsReadAsync(Guid conversationId, Guid readerId);
    
    // 5. Özel Sohbet Oluşturma/Getirme:
    // Sohbet ID'si döneceği için Result<Guid>
    Task<Result<Guid>> CreatePrivateConversationAsync(Guid senderId, Guid receiverId);
    // 6. Son Mesajı Getir
    Task<Result<MessageDto?>> GetLastMessageAsync(Guid conversationId);

    // 7. Mesaj Düzenleme
    Task<Result<MessageDto>> EditMessageAsync(Guid messageId, Guid userId, string newContent);

    // 8. Mesaj Arama
    Task<Result<IEnumerable<MessageDto>>> SearchMessagesAsync(Guid conversationId, Guid userId, string query);

    // 9. Reaksiyon Ekleme/Kaldırma
    Task<Result<MessageReactionDto>> AddReactionAsync(Guid messageId, Guid userId, string emoji);
    Task<Result<bool>> RemoveReactionAsync(Guid messageId, Guid userId, string emoji);

    // 10. Reconnection catch-up: belirli bir tarihten sonraki mesajlar
    Task<Result<IEnumerable<MessageDto>>> GetMessagesSinceAsync(Guid conversationId, DateTime since, Guid userId);
}