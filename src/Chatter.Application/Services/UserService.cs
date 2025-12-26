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

    public async Task<IEnumerable<UserDto>> SearchUsersAsync(string searchTerm)
    {
        var users = await _unitOfWork.Users.SearchUsersAsync(searchTerm, 1, 20);
        return users.Select(u => new UserDto
        {
            Id = u.Id,
            UserName = u.UserName!,
            FullName = u.FullName,
            ProfilePictureUrl = u.ProfilePictureUrl,
            IsOnline = u.IsOnline,
            LastSeenAt = u.LastSeenAt
        });
    }

    public async Task<IEnumerable<UserDto>> GetAllUsersAsync(string? currentUserId = null)
    {
        var users = await _unitOfWork.Users.GetAllAsync();
        
        // Exclude current user from list
        if (!string.IsNullOrEmpty(currentUserId))
        {
            users = users.Where(u => u.Id != currentUserId).ToList();
        }
        
        return users.Select(u => new UserDto
        {
            Id = u.Id,
            UserName = u.UserName!,
            FullName = u.FullName,
            ProfilePictureUrl = u.ProfilePictureUrl,
            IsOnline = u.IsOnline,
            LastSeenAt = u.LastSeenAt
        });
    }
}
