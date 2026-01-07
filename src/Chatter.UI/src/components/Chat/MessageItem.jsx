import { memo } from 'react';
import { Video, Phone, File, Maximize2, Check, CheckCheck, Download } from 'lucide-react';
import SecureImage from '../Common/SecureImage'; 
import { BACKEND_URL } from '../../config/constants'; 

const MessageItem = memo(({ msg, currentUserId, onImageClick }) => {
  
  // --- ID CHECK ---
  const rawMsgSenderId = msg.senderId || msg.SenderId || '';
  const rawCurrentUserId = currentUserId || '';
  const senderId = String(rawMsgSenderId).trim().toLowerCase();
  const myId = String(rawCurrentUserId).trim().toLowerCase();
  const isSentByMe = (senderId !== '' && myId !== '') && (senderId === myId);

  // Format time
  const formatTime = (date) => {
    try {
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // --- SYSTEM MESSAGES ---
  if (msg.type === 'System' || msg.type === 2) {
    const content = msg.content || '';
    const isNegative = content.includes('declined') || content.includes('Missed') || content.includes('ended');
    const isSuccess = content.includes('started') || content.includes('answered');
    
    return (
      <div className="flex flex-col items-center my-6 animate-fade-in">
        <div className={`
          flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-medium shadow-soft backdrop-blur-sm transition-all
          ${isNegative 
            ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
            : isSuccess
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-accent-light/50 border border-accent-primary/20 text-text-muted'
          }
        `}>
          <span className={`flex-shrink-0 ${isNegative ? 'text-red-400' : isSuccess ? 'text-green-400' : 'text-accent-primary'}`}>
            {content.includes('Video') ? <Video size={15} /> : <Phone size={15} />}
          </span>
          <span>{content}</span>
        </div>
        <span className="text-[10px] text-text-muted/50 mt-1.5 font-medium">
          {formatTime(msg.sentAt)}
        </span>
      </div>
    );
  }
  
  // --- NORMAL MESSAGE ---
  return (
    <div className={`
      flex flex-col mb-3 w-full animate-slide-up
      ${isSentByMe ? 'items-end' : 'items-start'}
    `}>
      
      {/* --- MESSAGE BUBBLE --- */}
      <div className={`
        relative px-4 py-2.5 shadow-soft text-sm break-words transition-all hover:shadow-soft-lg
        max-w-[85%] md:max-w-[70%] lg:max-w-[600px]
        ${isSentByMe 
          ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-white rounded-2xl rounded-tr-md' 
          : 'bg-bg-card border border-border-subtle text-text-main rounded-2xl rounded-tl-md'
        }
      `}>
        
        {/* --- ATTACHMENTS --- */}
        {msg.attachments?.map((att, index) => {
          const isImage = att.type === 1 || 
                         att.type === 'Image' || 
                         (att.fileName && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName));
          
          return (
            <div key={att.id || index} className={msg.content ? "mb-2.5" : "mb-0"}>
              {isImage ? (
                
                // --- IMAGE ATTACHMENT ---
                <div 
                  className="group relative cursor-pointer overflow-hidden rounded-xl border-2 border-transparent hover:border-accent-primary/30 transition-all" 
                  onClick={() => onImageClick(`${BACKEND_URL}${att.fileUrl}`)}
                >
                  <SecureImage 
                    src={`${BACKEND_URL}${att.fileUrl}`} 
                    alt={att.fileName || 'Image'} 
                    className="w-full h-auto max-h-[300px] object-cover" 
                  />
                  
                  {/* Image Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-3">
                    <span className="text-white text-xs font-medium truncate flex-1">
                      {att.fileName || 'Image'}
                    </span>
                    <Maximize2 size={20} className="text-white drop-shadow-lg flex-shrink-0" />
                  </div>
                </div>

              ) : (
                
                // --- FILE ATTACHMENT ---
                <a 
                  href={`${BACKEND_URL}${att.fileUrl}`} 
                  download={att.fileName}
                  target="_blank" 
                  rel="noreferrer" 
                  className={`
                    flex items-center gap-3 p-3 rounded-xl transition-all no-underline group
                    ${isSentByMe 
                      ? 'bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40' 
                      : 'bg-bg-hover/50 hover:bg-bg-hover border border-border-subtle hover:border-accent-primary/40'
                    }
                  `}
                >
                  {/* File Icon */}
                  <div className={`
                    p-2 rounded-lg transition-all
                    ${isSentByMe 
                      ? 'bg-white/10 text-white' 
                      : 'bg-accent-light text-accent-primary'
                    }
                  `}>
                    <File size={18} />
                  </div>
                  
                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isSentByMe ? 'text-white' : 'text-text-main'}`}>
                      {att.fileName || 'File'}
                    </p>
                    <p className={`text-[10px] ${isSentByMe ? 'text-white/70' : 'text-text-muted'}`}>
                      Tap to download
                    </p>
                  </div>
                  
                  {/* Download Icon */}
                  <Download 
                    size={16} 
                    className={`flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity ${isSentByMe ? 'text-white' : 'text-accent-primary'}`} 
                  />
                </a>
              )}
            </div>
          );
        })}

        {/* --- TEXT CONTENT --- */}
        {msg.content && (
          <p className="leading-relaxed whitespace-pre-wrap text-[15px]">
            {msg.content}
          </p>
        )}
      </div>
      
      {/* --- TIME & STATUS --- */}
      <div className="flex items-center gap-1.5 mt-1 px-1">
        <span className="text-[10px] text-text-muted font-medium">
          {formatTime(msg.sentAt)}
        </span>
        
        {isSentByMe && (
          <span className={`flex items-center transition-colors ${msg.isRead ? 'text-green-400' : 'text-text-muted/60'}`}>
            {msg.isRead ? (
              <CheckCheck size={14} className="drop-shadow-sm" />
            ) : (
              <Check size={14} />
            )}
          </span>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;