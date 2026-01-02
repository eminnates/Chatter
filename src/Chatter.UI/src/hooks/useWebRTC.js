import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';

export const useWebRTC = (connection, currentUserId, showToast) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, initiating, ringing, active, ended
  const [activeCall, setActiveCall] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);
  
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // Get user media (camera/microphone)
  const getUserMedia = useCallback(async (isVideoCall) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      if (showToast) {
        if (error.name === 'NotAllowedError') {
          showToast('Camera/microphone access denied. Please allow permissions.', 'error');
        } else if (error.name === 'NotFoundError') {
          showToast('No camera or microphone found.', 'error');
        } else {
          showToast('Failed to access camera/microphone.', 'error');
        }
      }
      throw error;
    }
  }, [showToast]);

  // Handle call end (cleanup)
  const handleCallEnd = useCallback(() => {
    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setActiveCall(null);
    setIsInitiator(false);
  }, []);

  // Initialize peer connection
  const createPeer = useCallback((initiator, stream) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (!activeCall) return;
      
      if (data.type === 'offer') {
        connection.invoke('SendWebRTCOffer', activeCall.id, JSON.stringify(data));
      } else if (data.type === 'answer') {
        connection.invoke('SendWebRTCAnswer', activeCall.id, JSON.stringify(data));
      } else if (data.candidate) {
        // Only send valid ICE candidates with actual candidate strings
        if (data.candidate.candidate && data.candidate.candidate.trim() !== '') {
          connection.invoke('SendICECandidate', 
            activeCall.id, 
            JSON.stringify(data.candidate),
            data.candidate.sdpMid || '',
            data.candidate.sdpMLineIndex || 0
          );
        }
      }
    });

    peer.on('stream', (stream) => {
      console.log('Received remote stream');
      setRemoteStream(stream);
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      if (showToast) {
        showToast('Connection error occurred', 'error');
      }
      handleCallEnd();
    });

    peer.on('close', () => {
      console.log('Peer connection closed');
      handleCallEnd();
    });

    peerRef.current = peer;
    return peer;
  }, [activeCall, connection, handleCallEnd, showToast]);

  // Initiate call
  const initiateCall = useCallback(async (receiverId, callType) => {
    try {
      setCallStatus('initiating');
      setIsInitiator(true);
      
      const isVideoCall = callType === 2; // Video = 2, Audio = 1
      const stream = await getUserMedia(isVideoCall);
      
      // Send initiate call signal to backend
      await connection.invoke('InitiateCall', receiverId, callType);
      
      // Set timeout for ringing state (45 seconds)
      callTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'ringing' && activeCall) {
          if (showToast) showToast('Call timeout - no answer', 'info');
          // Decline the call on backend (will create "Missed call" message)
          connection.invoke('DeclineCall', activeCall.id).catch(console.error);
          handleCallEnd();
        }
      }, 45000);
      
    } catch (error) {
      console.error('Error initiating call:', error);
      if (showToast) {
        showToast(error.message || 'Failed to initiate call', 'error');
      }
      handleCallEnd();
    }
  }, [connection, getUserMedia, showToast, handleCallEnd]);

  // Accept call
  const acceptCall = useCallback(async (call) => {
    try {
      setCallStatus('active');
      setActiveCall(call);
      setIsInitiator(false);
      
      const isVideoCall = call.type === 2;
      const stream = await getUserMedia(isVideoCall);
      
      // Accept call on backend
      await connection.invoke('AcceptCall', call.id);
      
      // Create peer as non-initiator
      createPeer(false, stream);
      
      // Clear any timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.error('Error accepting call:', error);
      if (showToast) {
        showToast('Failed to accept call', 'error');
      }
      handleCallEnd();
    }
  }, [connection, getUserMedia, createPeer, showToast, handleCallEnd]);

  // Decline call
  const declineCall = useCallback(async (callId) => {
    try {
      await connection.invoke('DeclineCall', callId);
      setCallStatus('idle');
      setActiveCall(null);
    } catch (error) {
      console.error('Error declining call:', error);
    }
  }, [connection]);

  // End call
  const endCall = useCallback(async () => {
    try {
      if (activeCall) {
        await connection.invoke('EndCall', activeCall.id);
      }
      handleCallEnd();
    } catch (error) {
      console.error('Error ending call:', error);
      handleCallEnd();
    }
  }, [connection, activeCall]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, []);

  // SignalR event handlers
  useEffect(() => {
    if (!connection) return;

    // Call initiated successfully
    const handleCallInitiated = (call) => {
      console.log('Call initiated:', call);
      setActiveCall(call);
      setCallStatus('ringing');
      // Don't create peer yet - wait until call is accepted
    };

    // Incoming call
    const handleIncomingCall = (call) => {
      console.log('Incoming call:', call);
      setActiveCall(call);
      setCallStatus('ringing');
    };

    // Call accepted
    const handleCallAccepted = (call) => {
      console.log('Call accepted:', call);
      setActiveCall(call);
      setCallStatus('active');
      
      // If initiator, create peer connection now
      if (isInitiator && localStreamRef.current && !peerRef.current) {
        createPeer(true, localStreamRef.current);
      }
    };

    // Call declined
    const handleCallDeclined = (call) => {
      console.log('Call declined:', call);
      handleCallEnd();
    };

    // Call ended
    const handleCallEnded = (call) => {
      console.log('Call ended:', call);
      handleCallEnd();
    };

    // Receive WebRTC offer
    const handleReceiveOffer = (signal) => {
      console.log('Received offer');
      const data = JSON.parse(signal.sdp);
      
      if (peerRef.current) {
        peerRef.current.signal(data);
      }
    };

    // Receive WebRTC answer
    const handleReceiveAnswer = (signal) => {
      console.log('Received answer');
      const data = JSON.parse(signal.sdp);
      
      if (peerRef.current) {
        peerRef.current.signal(data);
      }
    };

    // Receive ICE candidate
    const handleReceiveICECandidate = (signal) => {
      console.log('Received ICE candidate', signal);
      
      if (!signal.candidate || signal.candidate === '' || signal.candidate === 'null') {
        console.warn('Received empty ICE candidate, ignoring');
        return;
      }
      
      try {
        const candidate = JSON.parse(signal.candidate);
        
        // Check if the parsed candidate has a valid candidate string
        if (!candidate || !candidate.candidate || candidate.candidate.trim() === '') {
          console.warn('Parsed candidate has empty candidate string, ignoring');
          return;
        }
        
        if (peerRef.current) {
          peerRef.current.signal({ candidate });
        }
      } catch (error) {
        console.error('Error parsing ICE candidate:', error, signal);
      }
    };

    // Call error
    const handleCallError = (message) => {
      console.error('Call error:', message);
      if (showToast) {
        showToast(message || 'Call error occurred', 'error');
      }
      handleCallEnd();
    };

    // Register event handlers
    connection.on('CallInitiated', handleCallInitiated);
    connection.on('IncomingCall', handleIncomingCall);
    connection.on('CallAccepted', handleCallAccepted);
    connection.on('CallDeclined', handleCallDeclined);
    connection.on('CallEnded', handleCallEnded);
    connection.on('ReceiveOffer', handleReceiveOffer);
    connection.on('ReceiveAnswer', handleReceiveAnswer);
    connection.on('ReceiveICECandidate', handleReceiveICECandidate);
    connection.on('CallError', handleCallError);

    // Cleanup
    return () => {
      connection.off('CallInitiated', handleCallInitiated);
      connection.off('IncomingCall', handleIncomingCall);
      connection.off('CallAccepted', handleCallAccepted);
      connection.off('CallDeclined', handleCallDeclined);
      connection.off('CallEnded', handleCallEnded);
      connection.off('ReceiveOffer', handleReceiveOffer);
      connection.off('ReceiveAnswer', handleReceiveAnswer);
      connection.off('ReceiveICECandidate', handleReceiveICECandidate);
      connection.off('CallError', handleCallError);
    };
  }, [connection, createPeer, handleCallEnd, isInitiator]);

  // Cleanup on unmount only - end any active calls
  useEffect(() => {
    const currentCall = activeCall;
    const currentConnection = connection;
    
    return () => {
      if (currentCall && currentConnection) {
        try {
          currentConnection.invoke('EndCall', currentCall.id);
        } catch (error) {
          console.error('Error ending call on unmount:', error);
        }
      }
      handleCallEnd();
    };
    // Empty deps array - only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    localStream,
    remoteStream,
    callStatus,
    activeCall,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo
  };
};
