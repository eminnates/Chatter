import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';
import { Capacitor } from '@capacitor/core';

// Check if running on native platform and import permissions plugin dynamically
const requestNativePermissions = async () => {
  if (!Capacitor.isNativePlatform()) return true;
  
  try {
    const { Camera } = await import('@capacitor/camera');
    const cameraPermission = await Camera.requestPermissions({ permissions: ['camera'] });
    console.log('📷 Camera permission:', cameraPermission);
    return cameraPermission.camera === 'granted';
  } catch (error) {
    console.warn('⚠️ Native permission request failed, falling back to browser API:', error);
    return true;
  }
};

export const useWebRTC = (connection, currentUserId, showToast, showNotification) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [isInitiator, setIsInitiator] = useState(false);
  
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimeoutRef = useRef(null);

  // Get user media (camera/microphone)
  const getUserMedia = useCallback(async (isVideoCall) => {
    try {
      // Request native permissions first on mobile
      if (Capacitor.isNativePlatform()) {
        console.log('📱 Requesting native permissions...');
        const hasPermission = await requestNativePermissions();
        if (!hasPermission) {
          throw new Error('Camera permission denied');
        }
      }
      
      const constraints = {
        video: isVideoCall ? { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        } : false,
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      console.log('🎥 Requesting media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got media stream:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
      
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
      
    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      
      let errorMessage = 'Media access error';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone permission denied';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Camera or microphone not found';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone already in use';
      } else {
        errorMessage = `Media error: ${error.message}`;
      }
      
      if (showToast) showToast(errorMessage, 'error');
      throw error;
    }
  }, [showToast]);

  // Handle call end (cleanup)
  const handleCallEnd = useCallback(() => {
    console.log('🔚 Cleaning up call...');
    
    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`⏹️ Stopped ${track.kind} track`);
      });
    }
    
    // Close peer connection
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      console.log('🔌 Peer connection destroyed');
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setActiveCall(null);
    setIsInitiator(false);
  }, []);

  // Initialize peer connection
  const createPeer = useCallback((initiator, stream) => {
    console.log(`🔗 Creating peer connection (initiator: ${initiator})`);
    
    const peer = new Peer({
      initiator,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (!activeCall) {
        console.warn('⚠️ No active call, ignoring signal');
        return;
      }
      
      if (data.type === 'offer') {
        console.log('📤 Sending WebRTC offer');
        connection.invoke('SendWebRTCOffer', activeCall.id, JSON.stringify(data))
          .catch(err => console.error('❌ Error sending offer:', err));
          
      } else if (data.type === 'answer') {
        console.log('📤 Sending WebRTC answer');
        connection.invoke('SendWebRTCAnswer', activeCall.id, JSON.stringify(data))
          .catch(err => console.error('❌ Error sending answer:', err));
          
      } else if (data.candidate) {
        // Only send valid ICE candidates
        if (data.candidate.candidate && data.candidate.candidate.trim() !== '') {
          console.log('📤 Sending ICE candidate');
          connection.invoke('SendICECandidate', 
            activeCall.id, 
            JSON.stringify(data.candidate),
            data.candidate.sdpMid || '',
            data.candidate.sdpMLineIndex || 0
          ).catch(err => console.error('❌ Error sending ICE candidate:', err));
        }
      }
    });

    peer.on('stream', (stream) => {
      console.log('📥 Received remote stream');
      setRemoteStream(stream);
    });

    peer.on('error', (err) => {
      console.error('❌ Peer connection error:', err);
      if (showToast) showToast('Connection error occurred', 'error');
      handleCallEnd();
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed');
      handleCallEnd();
    });

    peerRef.current = peer;
    return peer;
  }, [activeCall, connection, handleCallEnd, showToast]);

  // Initiate call
  const initiateCall = useCallback(async (receiverId, callType) => {
    try {
      console.log(`📞 Initiating ${callType === 2 ? 'video' : 'audio'} call to user ${receiverId}`);
      
      setCallStatus('initiating');
      setIsInitiator(true);
      
      const isVideoCall = callType === 2;
      const stream = await getUserMedia(isVideoCall);
      
      // Send initiate call signal to backend
      console.log('📤 Sending InitiateCall to backend...');
      await connection.invoke('InitiateCall', receiverId, callType);
      
      // Set timeout for ringing state (45 seconds)
      callTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'ringing' && activeCall) {
          console.log('⏰ Call timeout - no answer');
          if (showToast) showToast('Call timeout - no answer', 'info');
          connection.invoke('DeclineCall', activeCall.id).catch(console.error);
          handleCallEnd();
        }
      }, 45000);
      
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      if (showToast) showToast(error.message || 'Failed to initiate call', 'error');
      handleCallEnd();
    }
  }, [connection, getUserMedia, showToast, handleCallEnd, callStatus, activeCall]);

  // ✅ FIXED: Accept call
  const acceptCall = useCallback(async (callIdOrObject) => {
    try {
      // Handle both call object and call ID
      const callId = typeof callIdOrObject === 'object' ? callIdOrObject.id : callIdOrObject;
      const callObject = typeof callIdOrObject === 'object' ? callIdOrObject : activeCall;
      
      if (!callId) {
        throw new Error('No call ID provided');
      }
      
      if (!callObject) {
        throw new Error('No call object available');
      }
      
      console.log('✅ Accepting call:', callId);
      console.log('📞 Call object:', callObject);
      
      setCallStatus('active');
      setActiveCall(callObject);
      setIsInitiator(false);
      
      // Handle both integer (1, 2) and string ('Audio', 'Video') enum values
      const isVideoCall = callObject.type === 2 || callObject.type === 'Video' || callObject.type === 'video';
      console.log(`🎥 Call type: ${isVideoCall ? 'video' : 'audio'}`);
      
      const stream = await getUserMedia(isVideoCall);
      
      // Accept call on backend
      console.log('📤 Sending AcceptCall to backend...');
      await connection.invoke('AcceptCall', callId);
      console.log('✅ Call accepted on backend');
      
      // Create peer as non-initiator
      createPeer(false, stream);
      
      // Clear any timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        callId: typeof callIdOrObject === 'object' ? callIdOrObject.id : callIdOrObject
      });
      
      if (showToast) showToast(`Failed to accept call: ${error.message}`, 'error');
      handleCallEnd();
    }
  }, [connection, getUserMedia, createPeer, showToast, handleCallEnd, activeCall]);

  // Decline call
  const declineCall = useCallback(async (callId) => {
    try {
      console.log('❌ Declining call:', callId);
      await connection.invoke('DeclineCall', callId);
      setCallStatus('idle');
      setActiveCall(null);
    } catch (error) {
      console.error('❌ Error declining call:', error);
    }
  }, [connection]);

  // End call
  const endCall = useCallback(async () => {
    try {
      if (activeCall) {
        console.log('🔚 Ending call:', activeCall.id);
        await connection.invoke('EndCall', activeCall.id);
      }
      handleCallEnd();
    } catch (error) {
      console.error('❌ Error ending call:', error);
      handleCallEnd();
    }
  }, [connection, activeCall, handleCallEnd]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log(`🎤 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
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
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        return videoTrack.enabled;
      }
    }
    return false;
  }, []);

  // SignalR event handlers
  useEffect(() => {
    if (!connection) return;

    const handleCallInitiated = (call) => {
      console.log('✅ Call initiated:', call);
      setActiveCall(call);
      setCallStatus('ringing');
    };

    const handleIncomingCall = (call) => {
      console.log('📞 Incoming call:', call);
      setActiveCall(call);
      setCallStatus('ringing');
      
      if (showNotification) {
        const isVideo = call.type === 2 || call.type === 'Video' || call.type === 'video';
        const callTypeText = isVideo ? 'Video' : 'Voice';
        const callerName = call.initiatorFullName || call.initiatorUsername || 'Someone';
        showNotification(call.initiatorId, callerName, `Incoming ${callTypeText} Call`);
      }
    };

    const handleCallAccepted = (call) => {
      console.log('✅ Call accepted:', call);
      setActiveCall(call);
      setCallStatus('active');
      
      if (isInitiator && localStreamRef.current && !peerRef.current) {
        console.log('🔗 Creating peer as initiator...');
        createPeer(true, localStreamRef.current);
      }
    };

    const handleCallDeclined = (call) => {
      console.log('❌ Call declined:', call);
      if (showToast) showToast('Call declined', 'info');
      handleCallEnd();
    };

    const handleCallEnded = (call) => {
      console.log('🔚 Call ended:', call);
      handleCallEnd();
    };

    const handleReceiveOffer = (signal) => {
      console.log('📥 Received WebRTC offer');
      try {
        const data = JSON.parse(signal.sdp);
        if (peerRef.current) {
          peerRef.current.signal(data);
        }
      } catch (error) {
        console.error('❌ Error processing offer:', error);
      }
    };

    const handleReceiveAnswer = (signal) => {
      console.log('📥 Received WebRTC answer');
      try {
        const data = JSON.parse(signal.sdp);
        if (peerRef.current) {
          peerRef.current.signal(data);
        }
      } catch (error) {
        console.error('❌ Error processing answer:', error);
      }
    };

    const handleReceiveICECandidate = (signal) => {
      console.log('📥 Received ICE candidate');
      
      if (!signal.candidate || signal.candidate === '' || signal.candidate === 'null') {
        console.warn('⚠️ Empty ICE candidate, ignoring');
        return;
      }
      
      try {
        const candidate = JSON.parse(signal.candidate);
        
        if (!candidate || !candidate.candidate || candidate.candidate.trim() === '') {
          console.warn('⚠️ Invalid candidate string, ignoring');
          return;
        }
        
        if (peerRef.current) {
          peerRef.current.signal({ candidate });
        }
      } catch (error) {
        console.error('❌ Error parsing ICE candidate:', error);
      }
    };

    const handleCallError = (message) => {
      console.error('❌ Call error:', message);
      if (showToast) showToast(message || 'Call error occurred', 'error');
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
  }, [connection, createPeer, handleCallEnd, isInitiator, showToast, showNotification]);

  // Cleanup on unmount
  useEffect(() => {
    const currentCall = activeCall;
    const currentConnection = connection;
    
    return () => {
      if (currentCall && currentConnection) {
        try {
          console.log('🧹 Cleanup: Ending call on unmount');
          currentConnection.invoke('EndCall', currentCall.id);
        } catch (error) {
          console.error('❌ Error ending call on unmount:', error);
        }
      }
      handleCallEnd();
    };
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