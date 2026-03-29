using Chatter.API.Hubs;
using Chatter.Domain.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace Chatter.API.Services;

/// <summary>
/// Background service that periodically cleans up stale ringing calls.
/// If a call stays in "Ringing" status for more than 60 seconds (e.g., caller crashed),
/// it is marked as Missed and participants are notified via SignalR.
/// </summary>
public class StaleCallCleanupService : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan RingingTimeout = TimeSpan.FromSeconds(60);

    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ILogger<StaleCallCleanupService> _logger;

    public StaleCallCleanupService(
        IServiceProvider serviceProvider,
        IHubContext<ChatHub> hubContext,
        ILogger<StaleCallCleanupService> logger)
    {
        _serviceProvider = serviceProvider;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("StaleCallCleanupService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(CheckInterval, stoppingToken);

            try
            {
                await CleanupStaleCallsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error during stale call cleanup");
            }
        }
    }

    private async Task CleanupStaleCallsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var staleCalls = await unitOfWork.Calls.GetStaleRingingCallsAsync(RingingTimeout, cancellationToken);
        var callList = staleCalls.ToList();

        if (callList.Count == 0) return;

        _logger.LogInformation("Found {Count} stale ringing calls to mark as missed", callList.Count);

        foreach (var call in callList)
        {
            call.MarkAsMissed();

            // Katılımcılara bildir
            if (call.Conversation?.Participants != null)
            {
                foreach (var participant in call.Conversation.Participants)
                {
                    await _hubContext.Clients
                        .User(participant.UserId.ToString())
                        .SendAsync("CallMissed", call.Id, cancellationToken);
                }
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
