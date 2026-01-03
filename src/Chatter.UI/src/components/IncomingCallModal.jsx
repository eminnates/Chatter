import React from 'react';
import { Phone, Video, X, Check } from 'lucide-react';
import './IncomingCallModal.css';

const IncomingCallModal = ({ call, onAccept, onDecline }) => {
  if (!call) return null;

  const isVideoCall = call.type === 2;
  const callType = isVideoCall ? 'Video' : 'Voice';

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <div className="call-icon">
          {isVideoCall ? <Video size={48} /> : <Phone size={48} />}
        </div>
        <h2>Incoming {callType} Call</h2>
        <p className="caller-name">{call.initiatorFullName || call.initiatorUsername}</p>
        <div className="call-buttons">
          <button className="decline-button" onClick={() => onDecline(call.id)}>
            <X size={20} />
            <span>Decline</span>
          </button>
          <button className="accept-button" onClick={() => onAccept(call)}>
            <Check size={20} />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
