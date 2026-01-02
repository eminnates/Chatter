import React, { useEffect, useRef, useState, useMemo } from 'react';
import './ActiveCallScreen.css';

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

  // Find the other participant
  const otherParticipant = useMemo(() => {
    if (!activeCall || !currentUserId) return null;
    
    // Find the ID of the other party
    const otherUserId = activeCall.participantIds?.find(id => id !== currentUserId);
    if (!otherUserId) return null;
    
    // Find user details from allUsers list
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
    
    // Always set remote audio stream for audio playback
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

  const isVideoCall = activeCall?.type === 2;

  return (
    <div className="active-call-overlay">
      <div className="active-call-screen">
        <div className="call-header">
          <div className="call-info">
            <h3>{otherParticipant?.fullName || otherParticipant?.userName || 'User'}</h3>
            <span className="call-duration">
              {remoteStream ? formatDuration(callDuration) : 'Connecting...'}
            </span>
          </div>
        </div>

        <div className="video-container">
          {isVideoCall ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
            </>
          ) : (
            <div className="audio-call-placeholder">
              <div className="audio-avatar">
                {(otherParticipant?.fullName || otherParticipant?.userName || 'U')[0].toUpperCase()}
              </div>
              <p className="audio-label">{remoteStream ? 'Audio Call' : 'Connecting...'}</p>
            </div>
          )}
          
          {/* Hidden audio element for audio playback (works for both audio and video calls) */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            style={{ display: 'none' }}
          />
        </div>

        <div className="call-controls">
          <button 
            className={`control-button ${isMuted ? 'active' : ''}`}
            onClick={handleToggleAudio}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {isVideoCall && (
            <button 
              className={`control-button ${isVideoOff ? 'active' : ''}`}
              onClick={handleToggleVideo}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? '📷' : '📹'}
            </button>
          )}

          <button 
            className="control-button end-call"
            onClick={onEndCall}
            title="End call"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveCallScreen;
