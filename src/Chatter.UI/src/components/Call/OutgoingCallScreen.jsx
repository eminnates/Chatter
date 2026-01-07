import React, { useEffect } from 'react';
import { PhoneOff, Video, Phone } from 'lucide-react';
import Ripple from '../Common/Ripple';

const OutgoingCallScreen = ({ call, users, onEndCall, currentUserId }) => {
  const otherUserId = call?.participantIds?.find(id => id !== currentUserId);
  const otherUser = users?.find(u => u.id === otherUserId);
  const receiverName = otherUser?.fullName || otherUser?.userName || "User";
  const isVideoCall = call?.type === 2 || call?.type === 'Video';

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onEndCall();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onEndCall]);

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-bg-main via-bg-sidebar to-bg-chat backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-md animate-scale-in">
        
        {/* Avatar with pulse rings */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Main Avatar */}
            <div className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white text-5xl font-bold shadow-soft-lg">
              {receiverName.charAt(0).toUpperCase()}
            </div>
            
            {/* Pulsing rings */}
            <div className="absolute inset-0 rounded-full bg-accent-primary/20 animate-ping"></div>
            <div className="absolute inset-0 rounded-full border-4 border-accent-primary/30 animate-pulse"></div>
          </div>
        </div>

        {/* Name and status */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-text-main mb-3">
            {receiverName}
          </h2>
          <div className="flex items-center justify-center gap-2 text-text-muted">
            {isVideoCall ? (
              <Video size={20} className="text-accent-warm" />
            ) : (
              <Phone size={20} className="text-accent-primary" />
            )}
            <span className="text-lg animate-pulse">Calling...</span>
          </div>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mb-12">
          <span 
            className="w-3 h-3 bg-accent-primary rounded-full animate-bounce" 
            style={{ animationDelay: '0s' }}
          ></span>
          <span 
            className="w-3 h-3 bg-accent-secondary rounded-full animate-bounce" 
            style={{ animationDelay: '0.2s' }}
          ></span>
          <span 
            className="w-3 h-3 bg-accent-primary rounded-full animate-bounce" 
            style={{ animationDelay: '0.4s' }}
          ></span>
        </div>

        {/* End call button */}
        <div className="flex justify-center">
          <button 
            onClick={onEndCall}
            className="relative group w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-soft-lg hover:shadow-glow transition-all duration-200 hover:scale-110 active:scale-95 ripple-container"
            title="End Call"
          >
            <PhoneOff size={28} className="text-white group-hover:rotate-12 transition-transform" />
            <Ripple color="rgba(239, 68, 68, 0.4)" />
          </button>
        </div>
        
        {/* Helper text */}
        <p className="text-center text-text-muted text-sm mt-6 animate-pulse">
          Tap to cancel • Press ESC
        </p>
      </div>
    </div>
  );
};

export default OutgoingCallScreen;