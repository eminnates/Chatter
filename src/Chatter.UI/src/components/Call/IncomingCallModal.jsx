import React, { useEffect } from 'react';
import { Phone, Video, X, Check } from 'lucide-react';
import Ripple from '../Common/Ripple';

const IncomingCallModal = ({ call, onAccept, onDecline }) => {
  if (!call) return null;

  // Call type check
  const isVideoCall = call.type === 2 || call.type === "Video" || call.type === "video";
  const callType = isVideoCall ? "Video" : "Voice";

  // Caller name
  const callerName = call.initiatorFullName || call.initiatorUsername || "Unknown Caller";

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onAccept(call.id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDecline(call.id);
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [call.id, onAccept, onDecline]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="relative bg-bg-card border border-border rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
        
        {/* Decorative gradient background */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent-warm/10 rounded-full blur-3xl"></div>
        
        {/* Content */}
        <div className="relative z-10">
          
          {/* Icon with pulse animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className={`
                w-24 h-24 rounded-full flex items-center justify-center shadow-soft-lg
                ${isVideoCall 
                  ? 'bg-gradient-to-br from-accent-warm to-accent-coral' 
                  : 'bg-gradient-to-br from-accent-primary to-accent-secondary'
                }
              `}>
                {isVideoCall ? (
                  <Video size={48} className="text-white" />
                ) : (
                  <Phone size={48} className="text-white animate-bounce-soft" />
                )}
              </div>
              
              {/* Pulse rings */}
              <div className={`
                absolute inset-0 rounded-full animate-ping
                ${isVideoCall ? 'bg-accent-warm/20' : 'bg-accent-primary/20'}
              `}></div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-text-main mb-2">
            Incoming {callType} Call
          </h2>

          {/* Caller name */}
          <div className="text-center mb-8">
            <p className="text-xl font-semibold text-accent-primary mb-1">
              {callerName}
            </p>
            <p className="text-sm text-text-muted">
              is calling you...
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Decline button */}
            <button
              onClick={() => onDecline(call.id)}
              className="relative group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/10 border-2 border-red-500/20 hover:bg-red-500 hover:border-red-500 text-red-500 hover:text-white transition-all duration-200 active:scale-95 ripple-container"
              title="Decline Call (ESC)"
            >
              <div className="w-12 h-12 rounded-full bg-red-500 group-hover:bg-white/20 flex items-center justify-center transition-all">
                <X size={24} className="text-white" />
              </div>
              <span className="text-sm font-semibold">Decline</span>
              <Ripple color="rgba(239, 68, 68, 0.3)" />
            </button>

            {/* Accept button */}
            <button
              onClick={() => onAccept(call.id)}
              className="relative group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-green-500/10 border-2 border-green-500/20 hover:bg-green-500 hover:border-green-500 text-green-500 hover:text-white transition-all duration-200 active:scale-95 ripple-container"
              title="Accept Call (ENTER)"
            >
              <div className="w-12 h-12 rounded-full bg-green-500 group-hover:bg-white/20 flex items-center justify-center transition-all animate-pulse">
                <Check size={24} className="text-white" />
              </div>
              <span className="text-sm font-semibold">Accept</span>
              <Ripple color="rgba(34, 197, 94, 0.3)" />
            </button>
          </div>

          {/* Keyboard shortcuts hint */}
          <p className="text-center text-text-muted text-xs mt-6">
            Press <kbd className="px-2 py-1 bg-bg-hover rounded text-xs">ENTER</kbd> to accept • <kbd className="px-2 py-1 bg-bg-hover rounded text-xs">ESC</kbd> to decline
          </p>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;