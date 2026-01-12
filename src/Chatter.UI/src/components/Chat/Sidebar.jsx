import { memo, useState, useEffect } from 'react';
import { Sun, Moon, Volume2, VolumeX, User, LogOut, Search, X } from 'lucide-react';
import UserListItem from './UserListItem';
import Ripple from '../Common/Ripple';

const Sidebar = memo(({ 
  user, 
  users, 
  selectedUser, 
  connectionStatus, 
  theme, 
  soundEnabled, 
  isMobile, 
  isMobileSidebarOpen, 
  onToggleTheme, 
  onToggleSound, 
  onProfileClick, 
  onLogout, 
  onSelectUser, 
  onContextMenu 
}) => {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);

  // ============================================
  // SEARCH FUNCTIONALITY
  // ============================================
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(u => 
      u.id !== user?.id && (
        (u.fullName?.toLowerCase().includes(query)) ||
        (u.userName?.toLowerCase().includes(query)) ||
        (u.lastMessage?.toLowerCase().includes(query))
      )
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users, user?.id]);

  // Separate online/offline users
  const onlineUsers = filteredUsers.filter(u => u.id !== user?.id && u.isOnline);
  const offlineUsers = filteredUsers.filter(u => u.id !== user?.id && !u.isOnline);

  return (
    <div 
      className={`
        flex flex-col h-full bg-bg-sidebar border-r border-border shadow-soft transition-all duration-300 ease-out z-50
        ${isMobile 
          ? 'fixed inset-y-0 left-0 w-[85%] max-w-[340px] shadow-2xl' 
          : 'relative w-[340px]'
        }
        ${isMobile && !isMobileSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}
    >
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex flex-col gap-4 p-5 border-b border-border bg-gradient-to-b from-bg-main/30 to-transparent backdrop-blur-sm">
        
        {/* App Title */}
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-accent-primary via-accent-purple to-accent-warm bg-clip-text text-transparent tracking-tight">
            Chatter
          </h3>
          
          {/* Online Count Badge */}
          {users.filter(u => u.isOnline && u.id !== user?.id).length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                {users.filter(u => u.isOnline && u.id !== user?.id).length}
              </span>
            </div>
          )}
        </div>
        
        {/* Current User Card */}
        <div className="relative group">
          <div 
            className="flex items-center gap-3 p-3 rounded-2xl bg-bg-card border border-border-subtle shadow-soft hover:shadow-soft-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            onClick={onProfileClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onProfileClick()}
            aria-label="View my profile"
          >
            {/* Avatar with Status Ring */}
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-semibold text-lg shadow-soft flex-shrink-0 group-hover:scale-110 transition-transform">
                {(user?.fullName || user?.userName)?.[0]?.toUpperCase()}
              </div>
              
              {/* Status Indicator */}
              {connectionStatus === 'connected' && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-bg-sidebar rounded-full">
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
                </span>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-main truncate text-sm group-hover:text-accent-primary transition-colors">
                {user?.fullName || user?.userName}
              </p>
              
              {/* Connection Status */}
              {connectionStatus === 'connected' ? (
                <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Connected
                </span>
              ) : connectionStatus === 'connecting' ? (
                <span className="flex items-center gap-1.5 text-xs text-yellow-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Reconnecting...
                </span>
              )}
            </div>
            
            {/* Arrow hint */}
            <User size={16} className="text-text-muted group-hover:text-accent-primary transition-colors flex-shrink-0" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-bg-card border border-border-subtle rounded-xl text-sm text-text-main placeholder-text-muted/60 outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all"
            aria-label="Search contacts"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-bg-hover text-text-muted hover:text-accent-primary transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2">
          
          {/* Theme Toggle */}
          <button 
            onClick={onToggleTheme} 
            className="relative group flex flex-col items-center justify-center p-3 rounded-xl bg-bg-card border border-border-subtle hover:bg-accent-light hover:border-accent-primary/40 hover:shadow-soft transition-all active:scale-95 ripple-container"
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' 
              ? <Sun size={20} className="text-text-muted group-hover:text-accent-warm transition-colors mb-1" /> 
              : <Moon size={20} className="text-text-muted group-hover:text-accent-primary transition-colors mb-1" />
            }
            <span className="text-[9px] text-text-muted group-hover:text-accent-primary transition-colors font-medium">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
            <Ripple color="rgba(184, 212, 168, 0.2)" />
          </button>
          
          {/* Sound Toggle */}
          <button 
            onClick={onToggleSound} 
            className="relative group flex flex-col items-center justify-center p-3 rounded-xl bg-bg-card border border-border-subtle hover:bg-accent-light hover:border-accent-primary/40 hover:shadow-soft transition-all active:scale-95 ripple-container"
            title={soundEnabled ? 'Mute' : 'Unmute'}
            aria-label={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          >
            {soundEnabled 
              ? <Volume2 size={20} className="text-text-muted group-hover:text-accent-primary transition-colors mb-1" /> 
              : <VolumeX size={20} className="text-text-muted group-hover:text-red-400 transition-colors mb-1" />
            }
            <span className="text-[9px] text-text-muted group-hover:text-accent-primary transition-colors font-medium">
              {soundEnabled ? 'Sound' : 'Muted'}
            </span>
            <Ripple color={soundEnabled ? "rgba(184, 212, 168, 0.2)" : "rgba(239, 68, 68, 0.2)"} />
          </button>
          
          {/* Profile */}
          <button 
            onClick={onProfileClick} 
            className="relative group flex flex-col items-center justify-center p-3 rounded-xl bg-bg-card border border-border-subtle hover:bg-accent-light hover:border-accent-primary/40 hover:shadow-soft transition-all active:scale-95 ripple-container"
            title="My Profile"
            aria-label="View my profile"
          >
            <User size={20} className="text-text-muted group-hover:text-accent-primary transition-colors mb-1" />
            <span className="text-[9px] text-text-muted group-hover:text-accent-primary transition-colors font-medium">
              Profile
            </span>
            <Ripple color="rgba(184, 212, 168, 0.2)" />
          </button>
          
          {/* Logout */}
          <button 
            onClick={onLogout} 
            className="relative group flex flex-col items-center justify-center p-3 rounded-xl bg-bg-card border border-border-subtle hover:bg-red-500/10 hover:border-red-500/40 hover:shadow-soft transition-all active:scale-95 ripple-container"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={20} className="text-text-muted group-hover:text-red-500 transition-colors mb-1" />
            <span className="text-[9px] text-text-muted group-hover:text-red-500 transition-colors font-medium">
              Logout
            </span>
            <Ripple color="rgba(239, 68, 68, 0.2)" />
          </button>
        </div>
      </div>
      
      {/* ============================================ */}
      {/* USER LIST */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-bg-hover hover:scrollbar-thumb-accent-primary/30 scrollbar-track-transparent">
        
        {/* Loading Skeleton */}
        {connectionStatus === 'connecting' && users.length === 0 ? (
          <div className="space-y-2 animate-fade-in">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 p-3 rounded-2xl bg-bg-card border-2 border-transparent animate-pulse"
              >
                {/* Avatar Skeleton */}
                <div className="w-12 h-12 rounded-full bg-bg-hover flex-shrink-0" />
                
                {/* Content Skeleton */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-bg-hover rounded w-24" />
                    <div className="h-3 bg-bg-hover rounded w-8" />
                  </div>
                  <div className="h-3 bg-bg-hover rounded w-32" />
                </div>
              </div>
            ))}
            
            {/* Loading Text */}
            <div className="text-center pt-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-light/50">
                <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-pulse" />
                <p className="text-xs text-accent-primary font-medium">
                  Loading contacts...
                </p>
              </div>
            </div>
          </div>
        ) : filteredUsers.length === 0 && searchQuery ? (
          /* No Search Results */
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 animate-fade-in">
            <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center">
              <Search size={32} className="text-accent-primary" />
            </div>
            <p className="text-sm font-medium text-text-main mb-2">
              No results found
            </p>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              Try searching with a different keyword
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-accent-primary hover:text-accent-secondary font-medium underline"
            >
              Clear search
            </button>
          </div>
        ) : users.filter(u => u.id !== user?.id).length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 animate-fade-in">
            <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center">
              <User size={32} className="text-accent-primary" />
            </div>
            <p className="text-sm font-medium text-text-main mb-2">
              No contacts yet
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              Your contacts will appear here ✨
            </p>
          </div>
        ) : (
          /* User List */
          <div className="space-y-1.5">
            {/* Online Users Section */}
            {onlineUsers.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Online ({onlineUsers.length})
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>
                
                {onlineUsers
                  .sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
                  .map(u => (
                    <UserListItem
                      key={u.id}
                      user={u}
                      isSelected={selectedUser?.id === u.id}
                      onClick={() => onSelectUser(u)}
                      onContextMenu={(e) => onContextMenu(e, u)}
                    />
                ))}
              </>
            )}
            
            {/* Offline Users Section */}
            {offlineUsers.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1 mb-1 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-text-muted/30" />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Offline ({offlineUsers.length})
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>
                
                {offlineUsers
                  .sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0))
                  .map(u => (
                    <UserListItem
                      key={u.id}
                      user={u}
                      isSelected={selectedUser?.id === u.id}
                      onClick={() => onSelectUser(u)}
                      onContextMenu={(e) => onContextMenu(e, u)}
                    />
                ))}
              </>
            )}
            
            {/* Total Count */}
            <div className="pt-3 pb-2 text-center">
              <span className="text-xs text-text-muted font-medium">
                {filteredUsers.filter(u => u.id !== user?.id).length} of {users.filter(u => u.id !== user?.id).length} contact{users.filter(u => u.id !== user?.id).length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;