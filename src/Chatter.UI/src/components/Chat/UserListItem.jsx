import { memo, useState } from 'react';
import { Phone, Video, Archive, Pin, Volume2, VolumeX, Trash2, MoreVertical } from 'lucide-react';
import Ripple from '../Common/Ripple';

const UserListItem = memo(({ user, isSelected, onClick, onContextMenu }) => {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isPinned, setIsPinned] = useState(user.isPinned || false);
  const [isMuted, setIsMuted] = useState(user.isMuted || false);
  
  // Format last message time - Enhanced
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Get typing indicator
  const isTyping = user.isTyping || false;

  // Handle quick action click
  const handleQuickAction = (e, action) => {
    e.stopPropagation();
    console.log(`Quick action: ${action} for user ${user.id}`);
    // Burada gerçek aksiyonlar yapılabilir
  };

  return (
    <div 
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
      className={`
        group relative flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 
        active:scale-[0.98] ripple-container overflow-hidden
        ${isSelected 
          ? 'bg-accent-light/80 border-2 border-accent-primary/40 shadow-soft scale-[1.02]' 
          : 'bg-bg-card hover:bg-bg-hover border-2 border-transparent hover:border-border-subtle hover:shadow-soft'
        }
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Chat with ${user.fullName || user.userName}`}
    >
      {/* Ripple Effect */}
      <Ripple color={isSelected ? "rgba(184, 212, 168, 0.3)" : "rgba(184, 212, 168, 0.2)"} />
      
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-accent-primary to-accent-secondary rounded-r-full shadow-glow" />
      )}

      {/* Pin Indicator */}
      {isPinned && !isSelected && (
        <div className="absolute top-2 right-2 z-10">
          <Pin size={12} className="text-accent-primary fill-accent-primary rotate-45" />
        </div>
      )}

      {/* Mute Indicator */}
      {isMuted && (
        <div className="absolute top-2 left-2 z-10">
          <VolumeX size={12} className="text-text-muted/60" />
        </div>
      )}
      
      {/* --- AVATAR --- */}
      <div className="relative shrink-0">
        <div className={`
          w-12 h-12 flex items-center justify-center rounded-full 
          bg-gradient-to-br from-accent-primary to-accent-secondary 
          text-white font-bold text-lg shadow-soft
          ${user.isOnline ? 'ring-2 ring-green-500/30 ring-offset-2 ring-offset-bg-card' : ''}
          transition-all duration-300 group-hover:scale-110 group-hover:rotate-3
        `}>
          {(user.fullName?.[0] || user.userName?.[0] || '?').toUpperCase()}
        </div>
        
        {/* Online Badge with Animation */}
        {user.isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-bg-card rounded-full shadow-sm z-10">
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

            {/* Verified Badge (optional) */}
            {user.isVerified && (
              <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
          {/* Last Message Time */}
          {user.lastMessageTime && (
            <span className={`text-[10px] font-medium shrink-0 ml-2 transition-colors ${
              user.unreadCount > 0 ? 'text-accent-primary' : 'text-text-muted'
            }`}>
              {formatTime(user.lastMessageTime)}
            </span>
          )}
        </div>
        
        {/* Bottom Row: Last Message / Typing + Badge */}
        <div className="flex justify-between items-center w-full gap-2">
          {/* Last Message Preview or Typing Indicator */}
          {isTyping ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              <span className="text-xs text-accent-primary font-medium ml-1">typing...</span>
            </div>
          ) : user.lastMessage ? (
            <p className={`
              text-xs truncate transition-colors leading-relaxed
              ${user.unreadCount > 0 
                ? 'text-text-main font-semibold' 
                : 'text-text-muted font-normal'
              }
            `}>
              {/* Show "You:" prefix for sent messages */}
              {user.lastMessageSentByMe && <span className="text-text-muted/70 font-normal">You: </span>}
              {user.lastMessage}
            </p>
          ) : (
            <p className="text-xs text-text-muted/50 italic">
              Say hello! 👋
            </p>
          )}
          
          {/* Unread Badge with Pulse */}
          {user.unreadCount > 0 && (
            <div className="relative flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-accent-warm to-accent-coral text-white text-[10px] font-bold shadow-soft shrink-0">
              <span className="absolute inset-0 rounded-full bg-accent-warm animate-ping opacity-40"></span>
              <span className="relative z-10">
                {user.unreadCount > 99 ? '99+' : user.unreadCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* --- QUICK ACTIONS (Desktop Hover) --- */}
      <div className={`
        absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 
        transition-all duration-200 z-20
        ${showQuickActions && !isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
      `}>
        {/* Voice Call */}
        <button
          onClick={(e) => handleQuickAction(e, 'voice-call')}
          className="p-1.5 rounded-lg bg-bg-card/95 backdrop-blur-sm border border-border-subtle hover:bg-accent-primary/10 hover:border-accent-primary text-text-muted hover:text-accent-primary transition-all active:scale-90 shadow-sm"
          title="Voice call"
          aria-label="Voice call"
        >
          <Phone size={14} />
        </button>

        {/* Video Call */}
        <button
          onClick={(e) => handleQuickAction(e, 'video-call')}
          className="p-1.5 rounded-lg bg-bg-card/95 backdrop-blur-sm border border-border-subtle hover:bg-accent-warm/10 hover:border-accent-warm text-text-muted hover:text-accent-warm transition-all active:scale-90 shadow-sm"
          title="Video call"
          aria-label="Video call"
        >
          <Video size={14} />
        </button>

        {/* More Options */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
          className="p-1.5 rounded-lg bg-bg-card/95 backdrop-blur-sm border border-border-subtle hover:bg-accent-light hover:border-accent-primary text-text-muted hover:text-accent-primary transition-all active:scale-90 shadow-sm"
          title="More options"
          aria-label="More options"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Hover Gradient Overlay */}
      <div className={`
        absolute inset-0 bg-gradient-to-r from-transparent via-accent-primary/5 to-transparent
        opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none
        ${isSelected ? 'hidden' : ''}
      `} />
    </div>
  );
});

UserListItem.displayName = 'UserListItem';

export default UserListItem;