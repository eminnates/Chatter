import { memo } from 'react';
import { Sun, Moon, Volume2, VolumeX, User, LogOut, Search, Sparkles } from 'lucide-react';
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
      {/* --- HEADER --- */}
      <div className="flex flex-col gap-4 p-5 border-b border-border bg-gradient-to-b from-bg-main/30 to-transparent backdrop-blur-sm">
        
        {/* App Title Only */}
        <h3 className="text-2xl font-bold bg-gradient-to-r from-accent-primary via-accent-purple to-accent-warm bg-clip-text text-transparent tracking-tight">
          Chatter
        </h3>
        
        {/* Current User Card */}
        <div className="relative group">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-bg-card border border-border-subtle shadow-soft hover:shadow-soft-lg transition-all cursor-pointer"
               onClick={onProfileClick}>
            
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-semibold text-lg shadow-soft flex-shrink-0">
              {(user?.fullName || user?.userName)?.[0]?.toUpperCase()}
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-main truncate text-sm">
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
                  Disconnected
                </span>
              )}
            </div>
            
            {/* Arrow hint */}
            <User size={16} className="text-text-muted group-hover:text-accent-primary transition-colors flex-shrink-0" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-2">
          
          {/* Theme Toggle */}
          <button 
            onClick={onToggleTheme} 
            className="relative group flex flex-col items-center justify-center p-3 rounded-xl bg-bg-card border border-border-subtle hover:bg-accent-light hover:border-accent-primary/40 hover:shadow-soft transition-all active:scale-95 ripple-container"
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
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
          >
            <LogOut size={20} className="text-text-muted group-hover:text-red-500 transition-colors mb-1" />
            <span className="text-[9px] text-text-muted group-hover:text-red-500 transition-colors font-medium">
              Logout
            </span>
            <Ripple color="rgba(239, 68, 68, 0.2)" />
          </button>
        </div>
      </div>
      
      {/* --- USER LIST --- */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-bg-hover hover:scrollbar-thumb-accent-primary/30 scrollbar-track-transparent">
        
        {/* Empty State */}
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 animate-fade-in">
            <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center">
              <Search size={32} className="text-accent-primary" />
            </div>
            <p className="text-sm font-medium text-text-main mb-2">
              {connectionStatus === 'connecting' ? 'Finding your friends...' : 'No friends yet'}
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              {connectionStatus === 'connecting' 
                ? 'Hang tight! We\'re loading your contacts.' 
                : 'Your friends will appear here when they join ✨'
              }
            </p>
          </div>
        ) : (
          
          /* User List */
          <div className="space-y-1.5">
            {/* Online Users First */}
            {users
              .filter(u => u.id !== user?.id && u.isOnline)
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
            
            {/* Offline Users */}
            {users
              .filter(u => u.id !== user?.id && !u.isOnline)
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
            
            {/* Total Count */}
            <div className="pt-3 pb-2 text-center">
              <span className="text-xs text-text-muted font-medium">
                {users.filter(u => u.id !== user?.id).length} contact{users.filter(u => u.id !== user?.id).length !== 1 ? 's' : ''}
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