using Chatter.Application.Common; 
using Chatter.Application.DTOs.Users;
using Chatter.Domain.Interfaces;

namespace Chatter.Application.Services;

public class UserService : IUserService
{
    private readonly IUnitOfWork _unitOfWork;

    public UserService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<UserDto>>> SearchUsersAsync(string searchTerm)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return Result<IEnumerable<UserDto>>.Success(Enumerable.Empty<UserDto>());
            }

            // Repository Guid beklerse ve searchTerm string ise sorun yok (isim araması yapıyoruz)
            var users = await _unitOfWork.Users.SearchUsersAsync(searchTerm, 1, 20);
            
            var dtos = users.Select(u => new UserDto
            {
                // DÜZELTME: u.Id Guid olduğu için '?' konulmaz.
                Id = u.Id.ToString(), 
                UserName = u.UserName!,
                FullName = u.FullName,
                ProfilePictureUrl = u.ProfilePictureUrl,
                IsOnline = u.IsOnline,
                LastSeenAt = u.LastSeenAt
            });

            return Result<IEnumerable<UserDto>>.Success(dtos);
        }
        catch (Exception ex)
        {
            return Result<IEnumerable<UserDto>>.Failure(new Error("User.SearchFailed", $"Arama sırasında hata oluştu: {ex.Message}"));
        }
    }

    public async Task<Result<IEnumerable<UserDto>>> GetAllUsersAsync(Guid? currentUserId = null)
    {
        try
        {
            // 1. Anonim istek
            if (!currentUserId.HasValue || currentUserId.Value == Guid.Empty)
            {
                var users = await _unitOfWork.Users.GetAllAsync();
                
                var simpleDtos = users.Select(u => new UserDto 
                { 
                    // DÜZELTME: Guid struct olduğu için direkt ToString()
                    Id = u.Id.ToString(), 
                    UserName = u.UserName!, 
                    FullName = u.FullName,
                    ProfilePictureUrl = u.ProfilePictureUrl,
                    IsOnline = u.IsOnline,
                    LastSeenAt = u.LastSeenAt
                });
                
                return Result<IEnumerable<UserDto>>.Success(simpleDtos);
            }

            // 2. Giriş yapmış kullanıcı (İstatistikli)
            var usersWithStats = await _unitOfWork.Users.GetUsersWithChatStatsAsync(currentUserId.Value);

            var detailedDtos = usersWithStats.Select(x => new UserDto
            {
                // DÜZELTME: x.User.Id Guid'dir. '?' konulmaz.
                Id = x.User.Id.ToString(),
                UserName = x.User.UserName!,
                FullName = x.User.FullName,
                ProfilePictureUrl = x.User.ProfilePictureUrl,
                IsOnline = x.User.IsOnline,
                LastSeenAt = x.User.LastSeenAt,
                
                UnreadCount = x.UnreadCount,
                LastMessageAt = x.LastMessageAt
            });

            return Result<IEnumerable<UserDto>>.Success(detailedDtos);
        }
        catch (Exception ex)
        {
            return Result<IEnumerable<UserDto>>.Failure(new Error("User.FetchFailed", $"Kullanıcı listesi alınamadı: {ex.Message}"));
        }
    }

    public async Task<Result<UserProfileResponse>> GetCurrentUserProfileAsync(Guid userId)
    {
        return await GetUserProfileAsync(userId);
    }

    public async Task<Result<UserProfileResponse>> GetUserProfileAsync(Guid userId)
    {
        try
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            
            if (user == null)
            {
                return Result<UserProfileResponse>.Failure(new Error("User.NotFound", "Kullanıcı bulunamadı."));
            }

            var profileResponse = new UserProfileResponse
            {
                Id = user.Id.ToString(),
                UserName = user.UserName!,
                FullName = user.FullName,
                Email = user.Email!,
                Bio = user.Bio,
                ProfilePictureUrl = user.ProfilePictureUrl,
                IsOnline = user.IsOnline,
                LastSeenAt = user.LastSeenAt,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt
            };

            return Result<UserProfileResponse>.Success(profileResponse);
        }
        catch (Exception ex)
        {
            return Result<UserProfileResponse>.Failure(new Error("User.ProfileFetchFailed", $"Profil bilgileri alınamadı: {ex.Message}"));
        }
    }

    public async Task<Result<UserProfileResponse>> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        try
        {
            var user = await _unitOfWork.Users.GetByIdAsync(userId);
            
            if (user == null)
            {
                return Result<UserProfileResponse>.Failure(new Error("User.NotFound", "Kullanıcı bulunamadı."));
            }

            // Username benzersizlik kontrolü (eğer değiştiriliyorsa)
            if (user.UserName != request.UserName)
            {
                var existingUser = await _unitOfWork.Users.GetByUsernameAsync(request.UserName);
                if (existingUser != null && existingUser.Id != userId)
                {
                    return Result<UserProfileResponse>.Failure(new Error("User.UsernameExists", "Bu kullanıcı adı zaten kullanılıyor."));
                }
            }

            // Profil bilgilerini güncelle
            user.FullName = request.FullName;
            user.UserName = request.UserName;
            user.Bio = request.Bio;
            user.ProfilePictureUrl = request.ProfilePictureUrl;
            user.UpdatedAt = DateTime.UtcNow;

            // Güncellemeyi kaydet
            await _unitOfWork.Users.UpdateAsync(user);
            await _unitOfWork.SaveChangesAsync();

            // Güncellenmiş profili döndür
            var profileResponse = new UserProfileResponse
            {
                Id = user.Id.ToString(),
                UserName = user.UserName!,
                FullName = user.FullName,
                Email = user.Email!,
                Bio = user.Bio,
                ProfilePictureUrl = user.ProfilePictureUrl,
                IsOnline = user.IsOnline,
                LastSeenAt = user.LastSeenAt,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt
            };

            return Result<UserProfileResponse>.Success(profileResponse);
        }
        catch (Exception ex)
        {
            return Result<UserProfileResponse>.Failure(new Error("User.ProfileUpdateFailed", $"Profil güncellenirken hata oluştu: {ex.Message}"));
        }
    }
}