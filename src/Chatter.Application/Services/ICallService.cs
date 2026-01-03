using Chatter.Application.Common;

namespace Chatter.Application.Services
{
    public interface ICallService
    {
        Task<Result<DTOs.Chat.CallDto>> InitiateCallAsync(DTOs.Chat.InitiateCallRequest request, Guid initiatorId);
        Task<Result<DTOs.Chat.CallDto>> AcceptCallAsync(Guid callId, Guid userId);
        Task<Result<DTOs.Chat.CallDto>> DeclineCallAsync(Guid callId, Guid userId);
        Task<Result<DTOs.Chat.CallDto>> EndCallAsync(Guid callId, Guid userId);
        Task<Result<DTOs.Chat.CallDto>> GetCallByIdAsync(Guid callId);
        Task<Result<List<DTOs.Chat.CallDto>>> GetCallHistoryAsync(Guid userId, int pageNumber = 1, int pageSize = 20);
        Task<Result<DTOs.Chat.CallDto?>> GetActiveCallByUserIdAsync(Guid userId);
        Task<Result<int>> ForceEndUserCallsAsync(Guid userId);
    }
}
