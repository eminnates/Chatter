namespace Chatter.Application.Services
{
    public interface IPushNotificationService
    {
        Task SendPushNotificationAsync(string fcmToken, string title, string body, Dictionary<string, string>? data = null);
        Task SendPushNotificationToUserAsync(Guid userId, string title, string body, Dictionary<string, string>? data = null);
    }
}
