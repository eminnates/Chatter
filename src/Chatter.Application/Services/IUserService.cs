using Chatter.Application.DTOs.Users;

namespace Chatter.Application.Services;

public interface IUserService
{
    Task<IEnumerable<UserDto>> SearchUsersAsync(string searchTerm);
    Task<IEnumerable<UserDto>> GetAllUsersAsync();
}
