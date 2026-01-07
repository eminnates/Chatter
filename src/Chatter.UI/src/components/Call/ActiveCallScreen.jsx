import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import Ripple from '../Common/Ripple';

const ActiveCallScreen = ({ 
  localStream, 
  remoteStream, 
  activeCall, 
  currentUserId,
  allUsers,
  onEndCall,
  onToggleAudio,
  onToggleVideo
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Find the other participant
  const otherParticipant = useMemo(() => {
    if (!activeCall || !currentUserId) return null;
    
    const otherUserId = activeCall.participantIds?.find(id => id !== currentUserId);
    if (!otherUserId) return null;
    
    return allUsers?.find(u => u.id === otherUserId) || {
      fullName: activeCall.initiatorId === otherUserId ? activeCall.initiatorFullName : 'User',
      userName: activeCall.initiatorId === otherUserId ? activeCall.initiatorUsername : 'User'
    };
  }, [activeCall, currentUserId, allUsers]);

  // Set up video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide controls
  useEffect(() => {
    let timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'm' || e.key === 'M') handleToggleAudio();
      else if (e.key === 'v' || e.key === 'V') handleToggleVideo();
      else if (e.key === 'Escape') onEndCall();
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleAudio = () => {
    const enabled = onToggleAudio();
    setIsMuted(!enabled);
  };

  const handleToggleVideo = () => {
    const enabled = onToggleVideo();
    setIsVideoOff(!enabled);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const isVideoCall = activeCall?.type === 2 || activeCall?.type === 'Video' || activeCall?.type === 'video';

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      
      {/* Header with call info */}
      <div className={`
        absolute top-0 left-0 right-0 z-20 p-6 bg-gradient-to-b from-black/80 to-transparent
        transition-all duration-300
        ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold text-lg shadow-soft">
              {(otherParticipant?.fullName || otherParticipant?.userName || 'U')[0].toUpperCase()}
            </div>
            
            {/* Name & Duration */}
            <div>
              <h3 className="text-white font-semibold text-lg">
                {otherParticipant?.fullName || otherParticipant?.userName || 'User'}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-medium
                  ${remoteStream 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                  }
                `}>
                  {remoteStream ? formatDuration(callDuration) : 'Connecting...'}
                </span>
                {isVideoCall && (
                  <span className="text-white/60 text-xs">Video Call</span>
                )}
              </div>
            </div>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="relative p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 ripple-container"
            title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            <Ripple color="rgba(255, 255, 255, 0.2)" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-black">
        {isVideoCall ? (
          <>
            {/* Remote Video (Full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Local Video (Picture-in-Picture) */}
            <div className={`
              absolute top-6 right-6 w-48 h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20
              transition-all duration-300
              ${showControls ? 'opacity-100' : 'opacity-50'}
              ${isVideoOff ? 'hidden' : 'block'}
            `}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* Video off overlay for local */}
            {isVideoOff && (
              <div className="absolute top-6 right-6 w-48 h-36 rounded-2xl bg-bg-card border-2 border-white/20 flex items-center justify-center">
                <div className="text-center">
                  <VideoOff size={32} className="text-white/60 mx-auto mb-2" />
                  <p className="text-xs text-white/60">Camera off</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Audio Call Placeholder */
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-bg-main via-bg-sidebar to-bg-chat">
            <div className="text-center animate-scale-in">
              <div className="w-40 h-40 mx-auto mb-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white text-6xl font-bold shadow-2xl animate-pulse">
                {(otherParticipant?.fullName || otherParticipant?.userName || 'U')[0].toUpperCase()}
              </div>
              <p className="text-text-muted text-lg">
                {remoteStream ? 'Audio Call' : 'Connecting...'}
              </p>
            </div>
          </div>
        )}
        
        {/* Hidden audio element */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          className="hidden"
        />
      </div>

      {/* Controls */}
      <div className={`
        absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/80 to-transparent
        transition-all duration-300
        ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}
      `}>
        <div className="flex items-center justify-center gap-4">
          
          {/* Mute/Unmute */}
          <button 
            onClick={handleToggleAudio}
            className={`
              relative group flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-95 ripple-container
              ${isMuted 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
              }
            `}
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </div>
            <span className="text-xs font-medium">
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
            <Ripple color="rgba(255, 255, 255, 0.2)" />
          </button>

          {/* Video toggle (only for video calls) */}
          {isVideoCall && (
            <button 
              onClick={handleToggleVideo}
              className={`
                relative group flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-95 ripple-container
                ${isVideoOff 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                  : 'bg-white/10 text-white hover:bg-white/20'
                }
              `}
              title={isVideoOff ? 'Turn on camera (V)' : 'Turn off camera (V)'}
            >
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                {isVideoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
              </div>
              <span className="text-xs font-medium">
                {isVideoOff ? 'Camera' : 'Camera'}
              </span>
              <Ripple color="rgba(255, 255, 255, 0.2)" />
            </button>
          )}

          {/* End call */}
          <button 
            onClick={onEndCall}
            className="relative group flex flex-col items-center gap-2 p-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95 ripple-container"
            title="End call (ESC)"
          >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
              <PhoneOff size={24} />
            </div>
            <span className="text-xs font-medium">End Call</span>
            <Ripple color="rgba(255, 255, 255, 0.3)" />
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <p className="text-center text-white/40 text-xs mt-4">
          <kbd className="px-2 py-1 bg-white/10 rounded">M</kbd> Mute • 
          <kbd className="px-2 py-1 bg-white/10 rounded ml-2">V</kbd> Camera • 
          <kbd className="px-2 py-1 bg-white/10 rounded ml-2">F</kbd> Fullscreen • 
          <kbd className="px-2 py-1 bg-white/10 rounded ml-2">ESC</kbd> End
        </p>
      </div>
    </div>
  );
};

export default ActiveCallScreen;