using Chatter.Domain.Entities;
using Chatter.Domain.Models;

namespace Chatter.Domain.Interfaces
{
    public interface IUserRepository : IGenericRepository<AppUser, Guid>
    {
        // GetByIdAsync BURADAN SİLİNDİ (Miras yoluyla geliyor)
        
        Task<IEnumerable<UserWithChatStats>> GetUsersWithChatStatsAsync(Guid currentUserId);
        
        Task<AppUser?> GetByEmailAsync(string email);
        Task<AppUser?> GetByUsernameAsync(string username);
        Task<IEnumerable<AppUser>> GetAllAsync();
        Task<IEnumerable<AppUser>> SearchUsersAsync(string searchTerm, int page, int pageSize);
        Task UpdateAsync(AppUser user);
        Task<bool> ExistsAsync(Guid id);
    }
}