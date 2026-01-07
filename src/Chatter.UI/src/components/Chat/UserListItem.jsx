import { memo } from 'react';
import Ripple from '../Common/Ripple';

const UserListItem = memo(({ user, isSelected, onClick, onContextMenu }) => {
  
  // Format last message time
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div 
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`
        group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 
        active:scale-[0.98] ripple-container overflow-hidden
        ${isSelected 
          ? 'bg-accent-light/80 border-2 border-accent-primary/40 shadow-soft' 
          : 'bg-bg-card hover:bg-bg-hover border-2 border-transparent hover:border-border-subtle hover:shadow-soft'
        }
      `}
    >
      {/* Ripple Effect */}
      <Ripple color={isSelected ? "rgba(184, 212, 168, 0.3)" : "rgba(184, 212, 168, 0.2)"} />
      
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-accent-primary to-accent-secondary rounded-r-full" />
      )}
      
      {/* --- AVATAR --- */}
      <div className="relative shrink-0">
        <div className={`
          w-12 h-12 flex items-center justify-center rounded-full 
          bg-gradient-to-br from-accent-primary to-accent-secondary 
          text-white font-bold text-lg shadow-soft
          ${user.isOnline ? 'ring-2 ring-green-500/30' : ''}
          transition-all group-hover:scale-105
        `}>
          {(user.fullName?.[0] || user.userName?.[0] || '?').toUpperCase()}
        </div>
        
        {/* Online Badge */}
        {user.isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-bg-sidebar rounded-full shadow-sm">
            <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
          </span>
        )}
      </div>
      
      {/* --- USER INFO --- */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        
        {/* Top Row: Name + Time */}
        <div className="flex justify-between items-center w-full mb-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Name */}
            <span className={`
              text-sm font-semibold truncate transition-colors
              ${isSelected ? 'text-accent-primary' : 'text-text-main group-hover:text-accent-primary'}
            `}>
              {user.fullName || user.userName}
            </span>
          </div>
          
          {/* Last Message Time */}
          {user.lastMessageTime && (
            <span className="text-[10px] text-text-muted font-medium shrink-0 ml-2">
              {formatTime(user.lastMessageTime)}
            </span>
          )}
        </div>
        
        {/* Bottom Row: Last Message + Badge */}
        <div className="flex justify-between items-center w-full gap-2">
          {/* Last Message Preview */}
          {user.lastMessage ? (
            <p className={`
              text-xs truncate transition-colors
              ${user.unreadCount > 0 
                ? 'text-text-main font-medium' 
                : 'text-text-muted'
              }
            `}>
              {user.lastMessage}
            </p>
          ) : (
            <p className="text-xs text-text-muted/50 italic">
              No messages yet
            </p>
          )}
          
          {/* Unread Badge */}
          {user.unreadCount > 0 && (
            <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-accent-warm to-accent-coral text-white text-[10px] font-bold shadow-soft shrink-0 animate-bounce-soft">
              {user.unreadCount > 99 ? '99+' : user.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

UserListItem.displayName = 'UserListItem';

export default UserListItem;