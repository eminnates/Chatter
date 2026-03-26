using System.Threading.Channels;
using Chatter.Application.Services;

namespace Chatter.API.Services;

public record PushNotificationMessage(
    Guid UserId,
    string Title,
    string Body,
    Dictionary<string, string>? Data = null
);

/// <summary>
/// Background queue for push notifications using bounded Channel<T>.
/// Decouples push notification delivery from SignalR hub methods,
/// so hub methods return instantly (~1ms) instead of waiting for Firebase (~500-2000ms).
///
/// Architecture: Producer-Consumer pattern via System.Threading.Channels.
/// - Producer: Hub methods call Enqueue() (non-blocking, ~nanoseconds)
/// - Consumer: PushNotificationBackgroundService reads and sends to Firebase
/// - Bounded capacity prevents unbounded memory growth under load
/// </summary>
public class PushNotificationQueue
{
    private readonly Channel<PushNotificationMessage> _channel;

    public PushNotificationQueue()
    {
        // Bounded channel with 1000 capacity.
        // If full, oldest notifications are dropped (FullMode.DropOldest)
        // to prevent memory growth when Firebase is slow/down.
        var options = new BoundedChannelOptions(1000)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,   // Only one BackgroundService reads
            SingleWriter = false   // Multiple hub methods can write concurrently
        };
        _channel = Channel.CreateBounded<PushNotificationMessage>(options);
    }

    public ChannelReader<PushNotificationMessage> Reader => _channel.Reader;

    /// <summary>
    /// Non-blocking enqueue. Returns false only if channel is completed.
    /// With DropOldest, TryWrite always succeeds unless the channel is closed.
    /// </summary>
    public bool Enqueue(PushNotificationMessage message)
    {
        return _channel.Writer.TryWrite(message);
    }

    public int PendingCount => _channel.Reader.Count;
}

/// <summary>
/// Background service that drains the push notification queue and sends via Firebase.
/// Runs as a hosted service for the lifetime of the application.
///
/// Resilience: Catches per-notification errors so one failure doesn't stop the queue.
/// </summary>
public class PushNotificationBackgroundService : BackgroundService
{
    private readonly PushNotificationQueue _queue;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<PushNotificationBackgroundService> _logger;

    public PushNotificationBackgroundService(
        PushNotificationQueue queue,
        IServiceProvider serviceProvider,
        ILogger<PushNotificationBackgroundService> logger)
    {
        _queue = queue;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Push notification background service started");

        await foreach (var notification in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var pushService = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();

                await pushService.SendPushNotificationToUserAsync(
                    notification.UserId,
                    notification.Title,
                    notification.Body,
                    notification.Data
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send push notification to user {UserId}", notification.UserId);
            }
        }

        _logger.LogInformation("Push notification background service stopped");
    }
}
