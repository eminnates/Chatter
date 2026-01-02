import React from 'react';
import './IncomingCallModal.css';

const IncomingCallModal = ({ call, onAccept, onDecline }) => {
  if (!call) return null;

  const isVideoCall = call.type === 2;
  const callType = isVideoCall ? 'Video' : 'Voice';
  const icon = isVideoCall ? '📹' : '📞';

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <div className="call-icon">{icon}</div>
        <h2>Incoming {callType} Call</h2>
        <p className="caller-name">{call.initiatorFullName || call.initiatorUsername}</p>
        <div className="call-buttons">
          <button className="decline-button" onClick={() => onDecline(call.id)}>
            ❌ Decline
          </button>
          <button className="accept-button" onClick={() => onAccept(call)}>
            ✅ Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
