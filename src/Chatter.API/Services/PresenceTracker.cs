using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Chatter.API.Services;

public record PresenceLogMessage(Guid UserId, string ConnectionId, bool IsConnected, DateTimeOffset Timestamp, string? UserAgent, string? IpAddress);

public class PresenceTracker
{
    // Dictionary to hold online users and their connections
    private readonly ConcurrentDictionary<Guid, HashSet<string>> _onlineUsers = new();

    // Channel for background DB writing (audit log)
    public readonly Channel<PresenceLogMessage> ActivityChannel = Channel.CreateUnbounded<PresenceLogMessage>();

    // Per-user connection limit: web + mobile + desktop + 2 extra tabs = 5 max.
    // Each WebSocket connection consumes ~40KB RAM. Without limits,
    // 1000 users × 10 tabs = 400MB just for connections.
    public const int MaxConnectionsPerUser = 5;

    /// <summary>
    /// Returns (isFirstConnection, evictedConnectionId).
    /// If the user exceeds MaxConnectionsPerUser, the oldest connection is evicted.
    /// </summary>
    public (bool IsFirstConnection, string? EvictedConnectionId) UserConnected(Guid userId, string connectionId, string? userAgent, string? ipAddress)
    {
        bool isFirstConnection = false;
        string? evictedConnection = null;

        _onlineUsers.AddOrUpdate(userId,
            _ =>
            {
                isFirstConnection = true;
                return new HashSet<string> { connectionId };
            },
            (_, existingConnections) =>
            {
                lock (existingConnections)
                {
                    // Evict oldest connection if at limit
                    if (existingConnections.Count >= MaxConnectionsPerUser)
                    {
                        evictedConnection = existingConnections.First();
                        existingConnections.Remove(evictedConnection);
                    }
                    existingConnections.Add(connectionId);
                }
                return existingConnections;
            });

        // Write to channel
        ActivityChannel.Writer.TryWrite(new PresenceLogMessage(userId, connectionId, true, DateTimeOffset.UtcNow, userAgent, ipAddress));

        return (isFirstConnection, evictedConnection);
    }

    public bool UserDisconnected(Guid userId, string connectionId)
    {
        bool isLastConnection = false;

        if (_onlineUsers.TryGetValue(userId, out var connections))
        {
            lock (connections)
            {
                connections.Remove(connectionId);
                if (connections.Count == 0)
                {
                    isLastConnection = true;
                }
            }

            if (isLastConnection)
            {
                _onlineUsers.TryRemove(userId, out _);
            }
        }

        // Write to channel
        ActivityChannel.Writer.TryWrite(new PresenceLogMessage(userId, connectionId, false, DateTimeOffset.UtcNow, null, null));

        return isLastConnection; // Return true if the user has no more active connections
    }

    public Task<string[]> GetOnlineUsers()
    {
        var onlineUsers = _onlineUsers.Keys.Select(k => k.ToString()).ToArray();
        return Task.FromResult(onlineUsers);
    }

    public Task<string[]> GetConnectionsForUser(Guid userId)
    {
        if (_onlineUsers.TryGetValue(userId, out var connections))
        {
            lock (connections)
            {
                return Task.FromResult(connections.ToArray());
            }
        }

        return Task.FromResult(Array.Empty<string>());
    }

    public bool IsUserOnline(Guid userId)
    {
        return _onlineUsers.ContainsKey(userId);
    }
}

public class PresenceAuditLogService : BackgroundService
{
    private readonly PresenceTracker _tracker;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PresenceAuditLogService> _logger;

    public PresenceAuditLogService(PresenceTracker tracker, IServiceProvider serviceProvider, ILogger<PresenceAuditLogService> logger)
    {
        _tracker = tracker;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var log in _tracker.ActivityChannel.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<Chatter.Domain.Interfaces.IUnitOfWork>();

                if (log.IsConnected)
                {
                    var connection = new Chatter.Domain.Entities.UserConnection
                    {
                        UserId = log.UserId,
                        ConnectionId = log.ConnectionId,
                        UserAgent = log.UserAgent,
                        IpAddress = log.IpAddress,
                        ConnectedAt = log.Timestamp.UtcDateTime,
                        IsActive = true
                    };
                    await unitOfWork.UserConnections.AddAsync(connection);
                    
                    var user = await unitOfWork.Users.GetByIdAsync(log.UserId);
                    if (user != null)
                    {
                        user.SetOnlineStatus(true);
                    }
                }
                else
                {
                    await unitOfWork.UserConnections.DisconnectAsync(log.ConnectionId);
                    
                    var activeConnections = await unitOfWork.UserConnections.GetUserActiveConnectionsAsync(log.UserId);
                    if (activeConnections == null || !activeConnections.Any())
                    {
                        var user = await unitOfWork.Users.GetByIdAsync(log.UserId);
                        if (user != null)
                        {
                            user.SetOnlineStatus(false);
                            user.LastSeenAt = DateTime.UtcNow;
                        }
                    }
                }
                
                await unitOfWork.SaveChangesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing presence log for user {userId}", log.UserId);
            }
        }
    }
}
