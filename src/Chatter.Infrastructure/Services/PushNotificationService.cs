using Chatter.Application.Services;
using Chatter.Domain.Interfaces;
using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;

namespace Chatter.Infrastructure.Services
{
    public class PushNotificationService : IPushNotificationService
    {
        private readonly IUnitOfWork _unitOfWork;
        private static bool _firebaseInitialized = false;
        private static readonly object _lock = new object();

        public PushNotificationService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
            InitializeFirebase();
        }

        private void InitializeFirebase()
        {
            lock (_lock)
            {
                if (!_firebaseInitialized && FirebaseApp.DefaultInstance == null)
                {
                    // Try environment variable first, then fallback to file in API directory
                    var credentialPath = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
                    
                    if (string.IsNullOrEmpty(credentialPath) || !File.Exists(credentialPath))
                    {
                        // Fallback to firebase-service-account.json in the current directory
                        credentialPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "firebase-service-account.json");
                        
                        // If not in base directory, try current directory
                        if (!File.Exists(credentialPath))
                        {
                            credentialPath = "firebase-service-account.json";
                        }
                    }
                    
                    if (File.Exists(credentialPath))
                    {
                        FirebaseApp.Create(new AppOptions
                        {
                            Credential = GoogleCredential.FromFile(credentialPath)
                        });
                        _firebaseInitialized = true;
                        Console.WriteLine($"✅ Firebase initialized successfully from: {credentialPath}");
                    }
                    else
                    {
                        Console.WriteLine("⚠️ Firebase credentials not found. Push notifications will not work.");
                        Console.WriteLine($"   Searched paths: {credentialPath}");
                    }
                }
            }
        }

        public async Task SendPushNotificationAsync(string fcmToken, string title, string body, Dictionary<string, string>? data = null)
        {
            if (FirebaseApp.DefaultInstance == null)
            {
                Console.WriteLine("⚠️ Firebase not initialized, skipping push notification");
                return;
            }

            try
            {
                var message = new Message
                {
                    Token = fcmToken,
                    Notification = new Notification
                    {
                        Title = title,
                        Body = body
                    },
                    Android = new AndroidConfig
                    {
                        Priority = Priority.High,
                        Notification = new AndroidNotification
                        {
                            Sound = "default",
                            ClickAction = "OPEN_ACTIVITY",
                            ChannelId = "chatter-messages"
                        }
                    },
                    Data = data ?? new Dictionary<string, string>()
                };

                var result = await FirebaseMessaging.DefaultInstance.SendAsync(message);
                Console.WriteLine($"📱 Push notification sent: {result}");
            }
            catch (FirebaseMessagingException ex)
            {
                Console.WriteLine($"❌ Firebase messaging error: {ex.Message}");
                
                // If token is invalid, we might want to remove it from the database
                if (ex.MessagingErrorCode == MessagingErrorCode.Unregistered)
                {
                    Console.WriteLine("⚠️ FCM token is invalid/unregistered");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Push notification error: {ex.Message}");
            }
        }

        public async Task SendPushNotificationToUserAsync(Guid userId, string title, string body, Dictionary<string, string>? data = null)
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            
            if (user == null || string.IsNullOrEmpty(user.FcmToken))
            {
                Console.WriteLine($"⚠️ User {userId} has no FCM token");
                return;
            }

            await SendPushNotificationAsync(user.FcmToken, title, body, data);
        }
    }
}
