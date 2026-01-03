using Chatter.Domain.Entities;
using Chatter.Domain.Enums;
using Chatter.Domain.Interfaces;
using Chatter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Chatter.Infrastructure.Repositories
{
    public class CallRepository : GenericRepository<Call, Guid>, ICallRepository
    {
        public CallRepository(ChatterDbContext context) : base(context)
        {
        }

        public async Task<Call?> GetCallWithDetailsAsync(Guid callId, CancellationToken cancellationToken = default)
        {
            return await _dbSet
                .Include(c => c.Conversation)
                    .ThenInclude(conv => conv.Participants)
                        .ThenInclude(p => p.User)
                .Include(c => c.Initiator)
                .FirstOrDefaultAsync(c => c.Id == callId, cancellationToken);
        }

        public async Task<IEnumerable<Call>> GetCallHistoryAsync(Guid userId, int pageNumber, int pageSize, CancellationToken cancellationToken = default)
        {
            return await _dbSet
                .Include(c => c.Conversation)
                    .ThenInclude(conv => conv.Participants)
                        .ThenInclude(p => p.User)
                .Include(c => c.Initiator)
                .Where(c => c.Conversation.Participants.Any(p => p.UserId == userId))
                .OrderByDescending(c => c.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);
        }

        public async Task<Call?> GetActiveCallByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            return await _dbSet
                .Include(c => c.Conversation)
                    .ThenInclude(conv => conv.Participants)
                .Where(c => c.Status == CallStatus.Active || c.Status == CallStatus.Ringing)
                .Where(c => c.Conversation.Participants.Any(p => p.UserId == userId))
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<IEnumerable<Call>> GetCallsByConversationIdAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            return await _dbSet
                .Include(c => c.Initiator)
                .Where(c => c.ConversationId == conversationId)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<int> ForceEndUserCallsAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var activeCalls = await _dbSet
                .Include(c => c.Conversation)
                    .ThenInclude(conv => conv.Participants)
                .Where(c => c.Status == CallStatus.Active || c.Status == CallStatus.Ringing)
                .Where(c => c.Conversation.Participants.Any(p => p.UserId == userId))
                .ToListAsync(cancellationToken);

            foreach (var call in activeCalls)
            {
                call.Status = CallStatus.Ended;
                call.EndedAt = DateTime.UtcNow;
                if (call.StartedAt.HasValue)
                {
                    call.DurationInSeconds = (int)(DateTime.UtcNow - call.StartedAt.Value).TotalSeconds;
                }
            }

            return activeCalls.Count;
        }
    }
}
