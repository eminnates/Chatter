import DOMPurify from "dompurify";
import { memo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Video, Phone, File, Maximize2, Check, CheckCheck, Download, Reply, Copy, Loader2, AlertCircle, Smile, Pencil } from 'lucide-react';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import SecureImage from '../Common/SecureImage';
import { BACKEND_URL } from '../../config/constants';

const MessageItem = memo(({ msg, currentUserId, onImageClick, onReply, onEdit, onAddReaction, onRemoveReaction, onRetry, isMobile }) => {
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerCoords, setPickerCoords] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef(null);
  const emojiPickerRef = useRef(null);
  const editInputRef = useRef(null);

  // --- ID CHECK ---
  const rawMsgSenderId = msg.senderId || msg.SenderId || '';
  const rawCurrentUserId = currentUserId || '';
  const senderId = String(rawMsgSenderId).trim().toLowerCase();
  const myId = String(rawCurrentUserId).trim().toLowerCase();
  const isSentByMe = (senderId !== '' && myId !== '') && (senderId === myId);

  // --- MESSAGE STATUS ---
  const isSending = msg.sending || false;
  const hasError = msg.error || false;

  // Format time - Enhanced
  const formatTime = (date) => {
    if (!date) return '';
    try {
      const msgDate = new Date(date);
      const now = new Date();
      const diffMs = now - msgDate;
      const diffMins = Math.floor(diffMs / 60000);

      // If today, show time
      if (diffMins < 1440) {
        return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // If yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (msgDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }

      // Older messages
      return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // --- REPLY DATA ---
  const replyData = msg.replyMessage || msg.ReplyMessage;

  // --- REACTIONS DATA ---
  const reactions = msg.reactions || [];
  const groupedReactions = reactions.reduce((acc, r) => {
    const emoji = r.emoji || r.Emoji;
    if (!acc[emoji]) acc[emoji] = [];
    acc[emoji].push(r.userId || r.UserId);
    return acc;
  }, {});

  // --- MOBILE LONG PRESS ---
  const handleTouchStart = () => {
    if (!isMobile) return;
    setIsLongPressing(true);
    longPressTimer.current = setTimeout(() => {
      setShowMobileActions(true);
      setIsLongPressing(false);
      // Haptic feedback if available
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      setIsLongPressing(false);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  };

  // Close mobile actions on outside click
  useEffect(() => {
    if (!showMobileActions) return;

    const handleClickOutside = () => setShowMobileActions(false);
    document.addEventListener('click', handleClickOutside);

    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMobileActions]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Focus edit input when editing
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing]);

  // --- ACTIONS ---
  const handleCopy = async () => {
    if (!msg.content) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleReply = () => {
    onReply({
      id: msg.id,
      senderId: msg.senderId || msg.SenderId,
      senderName: msg.senderName || msg.SenderName || (isSentByMe ? 'You' : 'User'),
      content: msg.content,
      attachments: msg.attachments
    });
    setShowMobileActions(false);
  };

  const handleStartEdit = () => {
    setEditContent(msg.content || '');
    setIsEditing(true);
    setShowMobileActions(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSaveEdit = () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === msg.content) {
      handleCancelEdit();
      return;
    }
    onEdit?.(msg.id, trimmed);
    setIsEditing(false);
    setEditContent('');
  };

  const handleEmojiSelect = (emojiData) => {
    onAddReaction?.(msg.id, emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleReactionClick = (emoji) => {
    const myReaction = groupedReactions[emoji]?.some(uid => String(uid).toLowerCase() === myId);
    if (myReaction) {
      onRemoveReaction?.(msg.id, emoji);
    } else {
      onAddReaction?.(msg.id, emoji);
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
          flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-medium shadow-soft transition-all hover:scale-105
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
      flex flex-col mb-3 w-full animate-slide-up group/message relative
      ${isSentByMe ? 'items-end' : 'items-start'}
    `}>

      {/* --- MESSAGE WRAPPER --- */}
      <div
        className="relative flex items-center max-w-[85%] md:max-w-[70%] lg:max-w-[600px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >

        {/* --- ACTION BUTTONS (Desktop Hover / Mobile Long-press) --- */}
        <div className={`
          absolute flex items-center gap-1 z-10
          ${isSentByMe ? '-left-24' : '-right-24'}
          ${isMobile
            ? (showMobileActions ? 'opacity-100' : 'opacity-0 pointer-events-none')
            : 'opacity-0 group-hover/message:opacity-100 pointer-events-none group-hover/message:pointer-events-auto'
          }
          transition-all duration-200
        `}>
          <button
            onClick={handleReply}
            className="p-2 rounded-full bg-bg-card border border-border shadow-sm text-text-muted hover:text-accent-primary hover:bg-accent-light hover:scale-110 active:scale-95 transition-all"
            title="Reply"
            aria-label="Reply to message"
          >
            <Reply size={14} />
          </button>

          {/* Emoji reaction button */}
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (!showEmojiPicker) {
                const rect = e.currentTarget.getBoundingClientRect();
                setPickerCoords({ top: rect.top, left: rect.left });
                setShowEmojiPicker(true);
              } else {
                setShowEmojiPicker(false);
              }
            }}
            className={`p-2 rounded-full bg-bg-card border border-border shadow-sm hover:text-yellow-500 hover:bg-yellow-500/10 hover:scale-110 active:scale-95 transition-all ${showEmojiPicker ? 'text-yellow-500 bg-yellow-500/10' : 'text-text-muted'}`}
            title="React"
            aria-label="Add reaction"
          >
            <Smile size={14} />
          </button>

          {/* Edit button (only for own text messages) */}
          {isSentByMe && msg.content && (
            <button
              onClick={handleStartEdit}
              className="p-2 rounded-full bg-bg-card border border-border shadow-sm text-text-muted hover:text-blue-500 hover:bg-blue-500/10 hover:scale-110 active:scale-95 transition-all"
              title="Edit"
              aria-label="Edit message"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {/* --- MORE ACTIONS (Mobile - Copy) --- */}
        {isMobile && showMobileActions && (
          <div
            className={`
              absolute flex items-center gap-1 z-10 animate-slide-in
              ${isSentByMe ? '-right-14' : '-left-14'}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {msg.content && (
              <button
                onClick={handleCopy}
                className="p-2 rounded-full bg-bg-card border border-border shadow-sm text-text-muted hover:text-accent-primary hover:bg-accent-light active:scale-90 transition-all"
                title={copied ? "Copied!" : "Copy"}
                aria-label="Copy message"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            )}
          </div>
        )}

        {/* --- EMOJI PICKER POPUP --- */}
        {showEmojiPicker && pickerCoords && createPortal(
          <div
            className={isMobile ? "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" : "fixed z-[9999]"}
            style={isMobile ? {} : { 
              top: Math.max(10, pickerCoords.top - 360) + 'px', 
              left: isSentByMe ? Math.max(10, pickerCoords.left - 300) + 'px' : Math.max(10, pickerCoords.left) + 'px',
            }}
            onClick={(e) => {
              if (isMobile && e.target === e.currentTarget) {
                setShowEmojiPicker(false);
              }
              e.stopPropagation();
            }}
          >
            <div ref={emojiPickerRef}>
              <Suspense fallback={<div className="w-[300px] h-[350px] bg-bg-card rounded-xl border border-border shadow-2xl flex items-center justify-center"><Loader2 size={24} className="animate-spin text-text-muted" /></div>}>
                <div className="bg-bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
                  <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  width={isMobile ? Math.min(300, window.innerWidth - 20) : 300}
                  height={isMobile ? 300 : 350}
                  searchDisabled={isMobile}
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                  theme="dark"
                  lazyLoadEmojis
                />
              </div>
            </Suspense>
            </div>
          </div>,
          document.body
        )}

        {/* --- MESSAGE BUBBLE --- */}
        <div className={`
          relative w-full px-4 py-2.5 shadow-soft text-sm break-words transition-all hover:shadow-soft-lg
          ${isLongPressing ? 'scale-[0.97] opacity-80' : ''}
          ${isSentByMe
            ? 'bg-gradient-to-br from-accent-primary to-accent-secondary text-white rounded-2xl rounded-tr-md'
            : 'bg-bg-card border border-border-subtle text-text-main rounded-2xl rounded-tl-md'
          }
          ${hasError ? 'border-2 border-red-500/50' : ''}
          ${isSending ? 'opacity-70' : ''}
        `}>

          {/* --- SENDER NAME (Group chats) --- */}
          {!isSentByMe && msg.senderName && (
            <div className="text-xs font-semibold text-accent-primary mb-1">
              {msg.senderName}
            </div>
          )}

          {/* --- REPLY CONTEXT --- */}
          {replyData && (
            <div
              className={`
                mb-2 p-2.5 rounded-lg text-xs border-l-4 cursor-pointer select-none
                flex flex-col gap-0.5 hover:bg-black/10 dark:hover:bg-white/5 transition-colors
                ${isSentByMe
                  ? 'bg-black/20 border-white/50 text-white/90'
                  : 'bg-bg-hover/50 border-accent-primary text-text-muted'
                }
              `}
              onClick={() => {
                // Scroll to replied message (future feature)
                console.log('Scroll to message:', replyData.id);
              }}
            >
              <span className="font-bold opacity-90 text-[11px]">
                {replyData.senderName || replyData.SenderName || 'User'}
              </span>
              <span className="truncate opacity-80 italic text-[11px]">
                {replyData.content || (replyData.attachments?.length ? '📷 Attachment' : 'Message')}
              </span>
            </div>
          )}

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
                    className="group/img relative cursor-pointer overflow-hidden rounded-xl border-2 border-transparent hover:border-accent-primary/30 transition-all active:scale-95"
                    onClick={() => onImageClick(`${BACKEND_URL}${att.fileUrl}`)}
                  >
                    <SecureImage
                      src={`${BACKEND_URL}${att.fileUrl}`}
                      alt={att.fileName || 'Image'}
                      className="w-full h-auto max-h-[300px] object-cover"
                    />

                    {/* Image Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-end justify-between p-3">
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
                      flex items-center gap-3 p-3 rounded-xl transition-all no-underline group/file active:scale-95
                      ${isSentByMe
                        ? 'bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40'
                        : 'bg-bg-hover/50 hover:bg-bg-hover border border-border-subtle hover:border-accent-primary/40'
                      }
                    `}
                  >
                    {/* File Icon */}
                    <div className={`
                      p-2 rounded-lg transition-all group-hover/file:scale-110
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
                        {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB • ` : ''}Tap to download
                      </p>
                    </div>

                    {/* Download Icon */}
                    <Download
                      size={16}
                      className={`flex-shrink-0 opacity-50 group-hover/file:opacity-100 transition-opacity ${isSentByMe ? 'text-white' : 'text-accent-primary'}`}
                    />
                  </a>
                )}
              </div>
            );
          })}

          {/* --- TEXT CONTENT / EDIT MODE --- */}
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className={`w-full px-2 py-1.5 rounded-lg text-[15px] resize-none outline-none min-h-[36px] max-h-24 ${
                  isSentByMe
                    ? 'bg-white/20 text-white placeholder-white/50 border border-white/30 focus:border-white/60'
                    : 'bg-bg-hover text-text-main border border-border focus:border-accent-primary'
                }`}
                rows={1}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className={`text-[11px] px-2 py-1 rounded-md transition-all ${
                    isSentByMe ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-text-muted hover:text-text-main hover:bg-bg-hover'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={`text-[11px] px-2 py-1 rounded-md font-medium transition-all ${
                    isSentByMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          ) : msg.content ? (
            <p 
              className="leading-relaxed whitespace-pre-wrap text-[15px] select-text"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content.replace(/\n/g, '<br />')) }}
            />
          ) : null}

          {/* --- EDITED LABEL --- */}
          {(msg.editedAt || msg.EditedAt) && !isEditing && (
            <span className={`text-[10px] italic mt-1 block ${isSentByMe ? 'text-white/50' : 'text-text-muted/60'}`}>
              edited
            </span>
          )}

          {/* --- SENDING/ERROR INDICATOR --- */}
          {isSending && (
            <div className="flex items-center gap-1.5 mt-2 text-xs opacity-70">
              <Loader2 size={12} className="animate-spin" />
              <span>Sending...</span>
            </div>
          )}

          {hasError && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
              <AlertCircle size={12} />
              <span>Failed to send</span>
            </div>
          )}
        </div>

        {/* --- DESKTOP CONTEXT MENU (Hover) --- */}
        {!isMobile && (
          <div className={`
            absolute flex items-center gap-1 z-10
            transition-all duration-200
            ${isSentByMe ? '-right-1 translate-x-full' : '-left-1 -translate-x-full'}
            opacity-0 group-hover/message:opacity-100 pointer-events-none group-hover/message:pointer-events-auto
          `}>
            {msg.content && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-bg-card border border-border-subtle hover:bg-accent-light hover:border-accent-primary text-text-muted hover:text-accent-primary transition-all active:scale-90 shadow-sm"
                title={copied ? "Copied!" : "Copy"}
                aria-label="Copy message"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* --- REACTIONS DISPLAY --- */}
      {Object.keys(groupedReactions).length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1.5 px-1 ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
          {Object.entries(groupedReactions).map(([emoji, userIds]) => {
            const iReacted = userIds.some(uid => String(uid).toLowerCase() === myId);
            return (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all active:scale-90
                  ${iReacted
                    ? 'bg-accent-primary/15 border-accent-primary/40 text-accent-primary'
                    : 'bg-bg-card/80 border-border-subtle text-text-muted hover:border-accent-primary/30'
                  }
                `}
                title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                aria-label={`${emoji} reaction, ${userIds.length} ${userIds.length > 1 ? 'people' : 'person'}${iReacted ? ', you reacted' : ''}`}
              >
                <span className="text-sm">{emoji}</span>
                {userIds.length > 1 && <span className="text-[10px] font-medium">{userIds.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* --- TIME & STATUS --- */}
      <div className="flex items-center gap-1.5 mt-1 px-1">
        <span className={`text-[10px] font-medium ${hasError ? 'text-red-400' : 'text-text-muted'}`}>
          {formatTime(msg.sentAt)}
        </span>

        {isSentByMe && !hasError && !isSending && (
          <span
            className={`flex items-center transition-colors ${msg.isRead ? 'text-blue-400' : 'text-text-muted/60'}`}
            aria-label={msg.isRead ? 'Read' : 'Sent'}
            role="img"
          >
            {msg.isRead ? (
              <CheckCheck size={14} className="drop-shadow-sm" />
            ) : (
              <Check size={14} />
            )}
          </span>
        )}

        {hasError && (
          <button
            onClick={() => onRetry?.(msg)}
            className="text-[10px] text-red-400 underline hover:text-red-300"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;
