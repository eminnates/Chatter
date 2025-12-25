using Chatter.Application.DTOs.Chat;
using Chatter.Domain.Entities;

namespace Chatter.Application.Services;

public interface IChatService
{
    Task<MessageDto> SendMessageAsync(SendMessageRequest request, string senderId);
    Task<IEnumerable<MessageDto>> GetConversationMessagesAsync(Guid conversationId, int pageNumber, int pageSize, string userId);
    Task<IEnumerable<ConversationDto>> GetUserConversationsAsync(string userId);
    Task MarkMessagesAsReadAsync(Guid conversationId, string userId);
    Task<Guid> CreatePrivateConversationAsync(string senderId, string receiverId);
}
