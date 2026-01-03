using Chatter.Application.Common;
using Chatter.Application.DTOs.Chat;
using Chatter.Domain.Entities;
using Chatter.Domain.Enums;
using Chatter.Domain.Interfaces;

namespace Chatter.Application.Services
{
    public class CallService : ICallService
    {
        private readonly IUnitOfWork _unitOfWork;

        public CallService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<Result<CallDto>> InitiateCallAsync(InitiateCallRequest request, Guid initiatorId)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                // Check if trying to call yourself
                if (initiatorId == request.ReceiverId)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.SelfCall", "You cannot call yourself."));
                }

                // Check if initiator is already in a call
                var existingCall = await _unitOfWork.Calls.GetActiveCallByUserIdAsync(initiatorId);
                if (existingCall != null)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.AlreadyInCall", "You are already in an active call."));
                }

                // Check if receiver is already in a call
                var receiverActiveCall = await _unitOfWork.Calls.GetActiveCallByUserIdAsync(request.ReceiverId);
                if (receiverActiveCall != null)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.ReceiverBusy", "The user is already in another call."));
                }

                // Get or create conversation
                var conversation = await _unitOfWork.Conversations.GetOneToOneConversationAsync(initiatorId, request.ReceiverId);
                
                if (conversation == null)
                {
                    conversation = new Conversation
                    {
                        Type = ConversationType.OneToOne,
                        CreatedAt = DateTime.UtcNow,
                        IsActive = true
                    };

                    await _unitOfWork.Conversations.AddAsync(conversation);
                    
                    var participants = new List<ConversationParticipant>
                    {
                        new() { ConversationId = conversation.Id, UserId = initiatorId, Role = ParticipantRole.Member },
                        new() { ConversationId = conversation.Id, UserId = request.ReceiverId, Role = ParticipantRole.Member }
                    };
                    
                    conversation.Participants = participants;
                    await _unitOfWork.SaveChangesAsync();
                }

                // Create call
                var call = new Call
                {
                    ConversationId = conversation.Id,
                    InitiatorId = initiatorId,
                    Type = request.Type,
                    Status = CallStatus.Ringing,
                    CreatedAt = DateTime.UtcNow
                };

                await _unitOfWork.Calls.AddAsync(call);
                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                // Get call with details for DTO
                var callWithDetails = await _unitOfWork.Calls.GetCallWithDetailsAsync(call.Id);
                
                return Result<CallDto>.Success(MapToDto(callWithDetails!));
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                return Result<CallDto>.Failure(new Error("Call.InitiateError", ex.Message));
            }
        }

        public async Task<Result<CallDto>> AcceptCallAsync(Guid callId, Guid userId)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                var call = await _unitOfWork.Calls.GetCallWithDetailsAsync(callId);
                
                if (call == null)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.NotFound", "Call not found."));
                }

                // Verify user is a participant
                var isParticipant = call.Conversation.Participants.Any(p => p.UserId == userId);
                if (!isParticipant)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.Unauthorized", "You are not a participant in this call."));
                }

                // Check if user already has an active call
                var existingCall = await _unitOfWork.Calls.GetActiveCallByUserIdAsync(userId);
                if (existingCall != null && existingCall.Id != callId)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.AlreadyInCall", "You are already in another call."));
                }

                call.Accept();
                _unitOfWork.Calls.Update(call);
                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                return Result<CallDto>.Success(MapToDto(call));
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                return Result<CallDto>.Failure(new Error("Call.AcceptError", ex.Message));
            }
        }

        public async Task<Result<CallDto>> DeclineCallAsync(Guid callId, Guid userId)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                var call = await _unitOfWork.Calls.GetCallWithDetailsAsync(callId);
                
                if (call == null)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.NotFound", "Call not found."));
                }

                var isParticipant = call.Conversation.Participants.Any(p => p.UserId == userId);
                if (!isParticipant)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.Unauthorized", "You are not a participant in this call."));
                }

                call.Decline();
                _unitOfWork.Calls.Update(call);
                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                return Result<CallDto>.Success(MapToDto(call));
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                return Result<CallDto>.Failure(new Error("Call.DeclineError", ex.Message));
            }
        }

        public async Task<Result<CallDto>> EndCallAsync(Guid callId, Guid userId)
        {
            await _unitOfWork.BeginTransactionAsync();
            try
            {
                var call = await _unitOfWork.Calls.GetCallWithDetailsAsync(callId);
                
                if (call == null)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.NotFound", "Call not found."));
                }

                var isParticipant = call.Conversation.Participants.Any(p => p.UserId == userId);
                if (!isParticipant)
                {
                    await _unitOfWork.RollbackTransactionAsync();
                    return Result<CallDto>.Failure(new Error("Call.Unauthorized", "You are not a participant in this call."));
                }

                call.End();
                _unitOfWork.Calls.Update(call);
                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();

                return Result<CallDto>.Success(MapToDto(call));
            }
            catch (Exception ex)
            {
                await _unitOfWork.RollbackTransactionAsync();
                return Result<CallDto>.Failure(new Error("Call.EndError", ex.Message));
            }
        }

        public async Task<Result<CallDto>> GetCallByIdAsync(Guid callId)
        {
            var call = await _unitOfWork.Calls.GetCallWithDetailsAsync(callId);
            
            if (call == null)
            {
                return Result<CallDto>.Failure(new Error("Call.NotFound", "Call not found."));
            }

            return Result<CallDto>.Success(MapToDto(call));
        }

        public async Task<Result<List<CallDto>>> GetCallHistoryAsync(Guid userId, int pageNumber = 1, int pageSize = 20)
        {
            var calls = await _unitOfWork.Calls.GetCallHistoryAsync(userId, pageNumber, pageSize);
            var callDtos = calls.Select(MapToDto).ToList();
            
            return Result<List<CallDto>>.Success(callDtos);
        }

        public async Task<Result<CallDto?>> GetActiveCallByUserIdAsync(Guid userId)
        {
            var call = await _unitOfWork.Calls.GetActiveCallByUserIdAsync(userId);
            
            if (call == null)
            {
                return Result<CallDto?>.Success(null);
            }

            return Result<CallDto?>.Success(MapToDto(call));
        }

        public async Task<Result<int>> ForceEndUserCallsAsync(Guid userId)
        {
            try
            {
                var endedCount = await _unitOfWork.Calls.ForceEndUserCallsAsync(userId);
                await _unitOfWork.SaveChangesAsync();
                return Result<int>.Success(endedCount);
            }
            catch (Exception ex)
            {
                return Result<int>.Failure(new Error("Call.ForceEndError", ex.Message));
            }
        }

        private CallDto MapToDto(Call call)
        {
            return new CallDto
            {
                Id = call.Id,
                ConversationId = call.ConversationId,
                InitiatorId = call.InitiatorId,
                InitiatorUsername = call.Initiator?.UserName ?? string.Empty,
                InitiatorFullName = call.Initiator?.FullName ?? string.Empty,
                Type = call.Type,
                Status = call.Status,
                CreatedAt = call.CreatedAt,
                StartedAt = call.StartedAt,
                EndedAt = call.EndedAt,
                DurationInSeconds = call.DurationInSeconds,
                ParticipantIds = call.Conversation?.Participants?.Select(p => p.UserId).ToList() ?? new List<Guid>()
            };
        }
    }
}
