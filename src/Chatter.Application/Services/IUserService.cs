using Chatter.Application.Common; // Result<T> için
using Chatter.Application.DTOs.Users;

namespace Chatter.Application.Services;

public interface IUserService
{
    // Arama işlemi başarılı mı, hata var mı kontrolü için Result
    Task<Result<IEnumerable<UserDto>>> SearchUsersAsync(string searchTerm);
    
    // User ID'leri Guid yapısında olduğu için string? yerine Guid? kullanıyoruz
    Task<Result<IEnumerable<UserDto>>> GetAllUsersAsync(Guid? currentUserId = null);
    
    // Profil işlemleri
    Task<Result<UserProfileResponse>> GetCurrentUserProfileAsync(Guid userId);
    Task<Result<UserProfileResponse>> GetUserProfileAsync(Guid userId);
    Task<Result<UserProfileResponse>> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    
    // FCM Token
    Task<Result<bool>> UpdateFcmTokenAsync(Guid userId, string fcmToken);
}