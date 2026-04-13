using Chatter.Application.Common;
using Chatter.Application.DTOs.Chat;

namespace Chatter.Application.Services;

public interface IChatService
{

    Task<Result<MessageDto>> SendMessageAsync(SendMessageRequest request, Guid senderId);
    
    Task<Result<IEnumerable<MessageDto>>> GetConversationMessagesAsync(Guid conversationId, int pageNumber, int pageSize, Guid userId);
    
    Task<Result<IEnumerable<ConversationDto>>> GetUserConversationsAsync(Guid userId);
    
    Task<Result<bool>> MarkMessagesAsReadAsync(Guid conversationId, Guid readerId);
    
    Task<Result<Guid>> CreatePrivateConversationAsync(Guid senderId, Guid receiverId);

    Task<Result<MessageDto?>> GetLastMessageAsync(Guid conversationId);

    Task<Result<MessageDto>> EditMessageAsync(Guid messageId, Guid userId, string newContent);

    Task<Result<IEnumerable<MessageDto>>> SearchMessagesAsync(Guid conversationId, Guid userId, string query);

    Task<Result<MessageReactionDto>> AddReactionAsync(Guid messageId, Guid userId, string emoji);
    
    Task<Result<bool>> RemoveReactionAsync(Guid messageId, Guid userId, string emoji);

    Task<Result<IEnumerable<MessageDto>>> GetMessagesSinceAsync(Guid conversationId, DateTime since, Guid userId);
}