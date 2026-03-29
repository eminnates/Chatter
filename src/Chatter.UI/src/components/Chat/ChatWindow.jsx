import { useEffect, useRef, useState, memo, useCallback, useMemo, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Phone, Video, Paperclip, X, Loader2, Send, Smile, Search, ChevronDown } from 'lucide-react';
import MessageItem from './MessageItem';
import Ripple from '../Common/Ripple';
import { Virtuoso } from 'react-virtuoso';
import { BACKEND_URL } from '../../config/constants';
import { avatarGradient } from '../../utils/helpers';

const EmojiPickerWrapper = lazy(() => import('./EmojiPickerWrapper'));

const ChatWindow = ({
  selectedUser,
  messages,
  messageInput,
  setMessageInput,
  sendMessage,
  onInitiateCall,
  onImageClick,
  isTyping,
  connectionStatus,
  isMobile,
  onMobileMenuOpen,
  onProfileView,
  callStatus,
  selectedFile,
  setSelectedFile,
  isUploading,
  uploadProgress,
  isCompressing,
  showProfilePage,
  currentUserId,
  replyingTo,
  setReplyingTo,
  onEditMessage,
  onAddReaction,
  onRemoveReaction,
  onSearchMessages,
  searchResults,
  isSearching,
  onRetryMessage
}) => {
  const virtuosoRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionPicker, setReactionPicker] = useState({ isOpen: false, msgId: null, coords: null, isSentByMe: false });
  const emojiPickerRef = useRef(null);
  const reactionPickerRef = useRef(null);

  // Close emoji pickers on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (reactionPicker.isOpen && reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
        setReactionPicker({ isOpen: false, msgId: null, coords: null, isSentByMe: false });
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, reactionPicker.isOpen]);

  const onChatEmojiClick = (emojiData) => {
    setMessageInput((prev) => prev + (emojiData.native || emojiData.emoji));
  };

  const handleOpenReactionPicker = useCallback((msgId, coords, isSentByMe) => {
    setReactionPicker({ isOpen: true, msgId, coords, isSentByMe });
  }, []);

  const handleReactionEmojiClick = (emojiData) => {
    if (reactionPicker.msgId) {
      onAddReaction?.(reactionPicker.msgId, emojiData.native || emojiData.emoji);
    }
    setReactionPicker({ isOpen: false, msgId: null, coords: null, isSentByMe: false });
  };

  // ============================================
  // SCROLL MANAGEMENT - Smart auto-scroll
  // ============================================
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior });
  }, []);

  // Virtuoso bottom state callback
  const handleAtBottomStateChange = useCallback((atBottom) => {
    isNearBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom);
  }, []);

  // Sadece alta yakınsa scroll et
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Dosya/Reply secildiginde scroll
  useEffect(() => {
    if (selectedFile || replyingTo) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [selectedFile, replyingTo, scrollToBottom]);

  // ============================================
  // AUTO FOCUS - Input'a otomatik odaklan
  // ============================================
  useEffect(() => {
    if (selectedUser && messageInputRef.current && !isMobile) {
      setTimeout(() => messageInputRef.current?.focus(), 100);
    }
  }, [selectedUser, isMobile]);

  // ============================================
  // KEYBOARD HANDLING - Mobilde keyboard açılınca scroll
  // ============================================
  useEffect(() => {
    if (!isMobile) return;
    const onResize = () => {
      // visualViewport shrinks when keyboard appears
      setTimeout(() => scrollToBottom(), 100);
    };
    window.visualViewport?.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, [isMobile]);

  // ============================================
  // LOADING STATE - Mesajlar yuklenirken
  // ============================================
  const selectedUserId = selectedUser?.id;
  useEffect(() => {
    if (selectedUserId) {
      setIsLoadingMessages(true);
      const timer = setTimeout(() => {
        setIsLoadingMessages(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (messages.length > 0) {
      setIsLoadingMessages(false);
    }
  }, [messages]);

  // ============================================
  // CONNECTION WARNING - Baglanti uyarisi
  // ============================================
  useEffect(() => {
    if (connectionStatus !== 'connected' && messageInput.trim()) {
      setShowConnectionWarning(true);
    } else {
      setShowConnectionWarning(false);
    }
  }, [connectionStatus, messageInput]);

  // ============================================
  // SEARCH - Reset on user change
  // ============================================
  useEffect(() => {
    setShowSearch(false);
    setSearchQuery('');
  }, [selectedUser]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Debounced search
  useEffect(() => {
    if (!showSearch || !searchQuery.trim()) return;
    const timer = setTimeout(() => {
      onSearchMessages?.(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch]);

  // Determine which messages to display
  const displayMessages = showSearch && searchQuery.trim() && searchResults ? searchResults : messages;

  // Date separator helper
  const formatDateLabel = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - msgDay) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
    }
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Inject date separators between messages from different days
  const messagesWithDates = useMemo(() => {
    const result = [];
    let lastDateStr = null;
    for (const msg of displayMessages) {
      if (msg.sentAt) {
        const dateStr = new Date(msg.sentAt).toDateString();
        if (dateStr !== lastDateStr) {
          result.push({ _type: 'date-separator', _date: new Date(msg.sentAt), _key: `sep-${dateStr}` });
          lastDateStr = dateStr;
        }
      }
      result.push(msg);
    }
    return result;
  }, [displayMessages]);

  // ============================================
  // EMPTY STATE
  // ============================================
  if (!selectedUser && !showProfilePage) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-bg-chat via-bg-main to-bg-chat text-center p-6 animate-fade-in">
        <div className="relative p-12 rounded-3xl bg-bg-card border border-border shadow-2xl max-w-md w-full animate-scale-in">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-accent-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-accent-warm/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/20">
              <Smile size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-text-main mb-3">
              Ready to chat?
            </h2>
            <p className="text-text-muted leading-relaxed">
              Pick a friend from the sidebar and start a warm conversation!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showProfilePage) return null;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg-chat overflow-hidden">

      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-4 py-3 bg-bg-sidebar border-b border-border shadow-soft z-20">

        {/* Left: Menu + User Info */}
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          {isMobile && (
            <button
              onClick={onMobileMenuOpen}
              className="relative p-2 -ml-1 rounded-xl text-accent-primary hover:bg-accent-light active:scale-95 transition-all ripple-container"
              aria-label="Open menu"
            >
              <Menu size={22} />
              <Ripple color="rgba(184, 212, 168, 0.3)" />
            </button>
          )}

          {/* Avatar + User Info - Clickable */}
          <div
            onClick={onProfileView}
            className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer group hover:bg-accent-light/30 rounded-xl p-2 -ml-2 transition-all"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onProfileView()}
          >
            {/* Avatar */}
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(selectedUser?.id)} flex items-center justify-center text-white font-semibold text-lg shadow-soft flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden`}>
              {selectedUser.profilePictureUrl ? (
                <img
                  src={selectedUser.profilePictureUrl.startsWith('http') ? selectedUser.profilePictureUrl : `${BACKEND_URL}${selectedUser.profilePictureUrl}`}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                />
              ) : null}
              <span className="flex items-center justify-center w-full h-full" style={{ display: selectedUser.profilePictureUrl ? 'none' : undefined }}>
                {(selectedUser.fullName || selectedUser.userName)?.[0]?.toUpperCase()}
              </span>
            </div>

            {/* Name & Status */}
            <div className="flex flex-col justify-center min-w-0">
              <h3 className="font-semibold text-text-main truncate text-base">
                {selectedUser.fullName || selectedUser.userName}
              </h3>
              {isTyping ? (
                <span className="text-xs text-accent-primary font-medium flex items-center gap-1">
                  <span className="w-1 h-1 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                  <span className="w-1 h-1 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                  <span className="w-1 h-1 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                  typing...
                </span>
              ) : selectedUser.isOnline ? (
                <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                  <span className="inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  Online
                </span>
              ) : (
                <span className="text-xs text-text-muted">Offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Search Messages */}
          <button
            className={`relative p-2.5 rounded-xl transition-all active:scale-95 ripple-container ${
              showSearch
                ? 'bg-accent-primary/15 text-accent-primary'
                : 'bg-bg-card hover:bg-accent-primary/10 text-text-muted hover:text-accent-primary'
            }`}
            onClick={() => { setShowSearch(s => !s); setSearchQuery(''); }}
            title="Search Messages"
            aria-label="Search messages"
          >
            <Search size={18} />
            <Ripple color="rgba(184, 212, 168, 0.3)" />
          </button>

          {/* Voice Call */}
          <button
            className="relative p-2.5 rounded-xl bg-bg-card hover:bg-accent-primary/10 text-accent-primary hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 ripple-container"
            onClick={() => onInitiateCall(selectedUser.id, 1)}
            disabled={callStatus !== 'idle'}
            title="Voice Call"
            aria-label="Voice call"
          >
            <Phone size={18} />
            <Ripple color="rgba(184, 212, 168, 0.3)" />
          </button>

          {/* Video Call */}
          <button
            className="relative p-2.5 rounded-xl bg-bg-card hover:bg-accent-warm/10 text-accent-warm hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 ripple-container"
            onClick={() => onInitiateCall(selectedUser.id, 2)}
            disabled={callStatus !== 'idle'}
            title="Video Call"
            aria-label="Video call"
          >
            <Video size={18} />
            <Ripple color="rgba(255, 140, 97, 0.3)" />
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* SEARCH BAR */}
      {/* ============================================ */}
      {showSearch && (
        <div className="px-4 py-2 bg-bg-sidebar border-b border-border flex items-center gap-2 animate-slide-up">
          <Search size={16} className="text-text-muted flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in conversation..."
            className="flex-1 bg-transparent text-sm text-text-main placeholder-text-muted/60 outline-none"
          />
          {isSearching && <Loader2 size={16} className="text-accent-primary animate-spin flex-shrink-0" />}
          {searchQuery && (
            <span className="text-[11px] text-text-muted flex-shrink-0">
              {searchResults ? `${searchResults.length} found` : ''}
            </span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="p-1 rounded-full hover:bg-bg-hover text-text-muted hover:text-text-main transition-all"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ============================================ */}
      {/* MESSAGES AREA */}
      {/* ============================================ */}
      <div
        id="chat-messages-area"
        className="relative flex-1 overflow-hidden"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {/* Loading Skeleton */}
        {isLoadingMessages ? (
          <div className="h-full overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-bg-hover hover:scrollbar-thumb-accent-primary/30 scrollbar-track-transparent">
            <div className="space-y-3 animate-fade-in">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-pulse`}
                >
                  <div className={`flex items-end gap-2 max-w-[70%] ${i % 2 === 0 ? 'flex-row-reverse' : 'flex-row'}`}>
                    {i % 2 !== 0 && (
                      <div className="w-8 h-8 rounded-full bg-bg-hover flex-shrink-0" />
                    )}
                    <div className={`
                      px-4 py-3 rounded-2xl space-y-2
                      ${i % 2 === 0
                        ? 'bg-accent-primary/20 rounded-tr-md'
                        : 'bg-bg-card rounded-tl-md'
                      }
                    `}>
                      <div className="h-3 bg-bg-hover rounded w-48" />
                      {i % 3 === 0 && (
                        <div className="h-3 bg-bg-hover rounded w-32" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 animate-fade-in">
            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center">
              {showSearch && searchQuery ? <Search size={32} className="text-text-muted" /> : <Smile size={32} className="text-accent-primary" />}
            </div>
            <p className="text-sm font-medium text-text-main mb-1">
              {showSearch && searchQuery ? 'No messages found' : 'No messages yet'}
            </p>
            <p className="text-xs text-text-muted">
              {showSearch && searchQuery
                ? `No results for "${searchQuery}"`
                : `Start the conversation with ${selectedUser.fullName || selectedUser.userName}!`
              }
            </p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%', width: '100%' }}
            className="scrollbar-thin scrollbar-thumb-bg-hover hover:scrollbar-thumb-accent-primary/30 scrollbar-track-transparent"
            data={messagesWithDates}
            initialTopMostItemIndex={messagesWithDates.length - 1}
            components={{ Footer: () => isTyping ? <div style={{ height: 48 }} /> : null }}
            itemContent={(index, item) => {
              if (item._type === 'date-separator') {
                return (
                  <div className="flex items-center justify-center my-3 px-4">
                    <div className="px-3 py-1 rounded-full bg-bg-card text-text-muted text-xs font-medium border border-border-subtle shadow-soft">
                      {formatDateLabel(item._date)}
                    </div>
                  </div>
                );
              }
              return (
                <div className="px-4 py-1">
                  <MessageItem
                    key={item.id || `temp-${index}`}
                    msg={item}
                    currentUserId={currentUserId}
                    onImageClick={onImageClick}
                    onReply={setReplyingTo}
                    onEdit={onEditMessage}
                    onAddReaction={onAddReaction}
                    onRemoveReaction={onRemoveReaction}
                    onRetry={onRetryMessage}
                    isMobile={isMobile}
                    onOpenReactionPicker={handleOpenReactionPicker}
                  />
                </div>
              );
            }}
            followOutput="auto"
            atBottomStateChange={handleAtBottomStateChange}
            atBottomThreshold={150}
          />
        )}

        {/* Typing Indicator - overlaid at bottom, always mounted to avoid animation restart */}
        <div className={`absolute bottom-2 left-4 z-10 transition-opacity duration-200 ${isTyping && !isLoadingMessages && !showSearch ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-2 p-3 w-fit bg-bg-card border border-border-subtle rounded-2xl rounded-tl-md shadow-soft">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
              <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
            <span className="text-xs text-text-muted">typing</span>
          </div>
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && !isLoadingMessages && displayMessages.length > 0 && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-bg-card border border-border-subtle shadow-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-bg-hover transition-all animate-fade-in"
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={18} />
          </button>
        )}
      </div>

      {/* ============================================ */}
      {/* INPUT AREA */}
      {/* ============================================ */}
      <form
        className="relative p-3 bg-bg-sidebar border-t border-border shadow-soft z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        onSubmit={sendMessage}
      >

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-accent-light/30 overflow-hidden rounded-t-xl">
            <div
              className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-300 shadow-glow"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        {/* Connection Warning */}
        {showConnectionWarning && (
          <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-2 animate-slide-up">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
              {connectionStatus === 'connecting'
                ? 'Reconnecting... Your message will be sent when connected.'
                : 'Connection lost. Check your internet connection.'}
            </span>
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-3 p-3 bg-bg-card border-l-4 border-accent-primary rounded-r-xl shadow-soft flex items-center justify-between animate-slide-up">
            <div className="flex flex-col overflow-hidden mr-3 flex-1">
              <span className="text-xs font-bold text-accent-primary mb-1">
                Replying to {replyingTo.senderName || 'User'}
              </span>
              <span className="text-xs text-text-muted truncate">
                {replyingTo.content || (replyingTo.attachments?.length ? '📷 Attachment' : 'Message')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1.5 rounded-full hover:bg-bg-hover text-text-muted hover:text-red-500 transition-colors active:scale-90 flex-shrink-0"
              title="Cancel Reply"
              aria-label="Cancel reply"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* File Preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-bg-card border border-border-subtle rounded-2xl flex items-center justify-between shadow-soft animate-slide-up">
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 text-accent-primary flex-shrink-0">
                <Paperclip size={20} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm text-text-main font-medium truncate">{selectedFile.name}</span>
                <span className="text-xs text-text-muted">
                  {isCompressing ? (
                    <span className="flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      Compressing...
                    </span>
                  ) : (
                    `${(selectedFile.size / 1024).toFixed(1)} KB`
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="relative p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 ripple-container flex-shrink-0"
              title="Remove file"
              aria-label="Remove file"
            >
              <X size={16} />
              <Ripple color="rgba(239, 68, 68, 0.3)" />
            </button>
          </div>
        )}

        {/* Input Container */}
        <div className="flex flex-row items-end justify-between w-full h-auto gap-1 sm:gap-2" ref={emojiPickerRef}>
          
          {/* LEFT COMMANDS CONTAINER (Attach & Emoji) */}
          <div className="flex flex-row items-end justify-start gap-1 shrink-0 mb-[6px]">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              aria-label="File upload"
            />

            {/* Attach Button */}
            <button
              type="button"
              className="relative flex items-center justify-center h-[44px] w-[36px] sm:w-[44px] sm:rounded-2xl rounded-xl text-text-muted hover:text-accent-primary hover:bg-accent-light transition-all active:scale-95 ripple-container flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || connectionStatus !== 'connected'}
              title="Attach File"
              aria-label="Attach file"
            >
              <Paperclip size={20} />
              <Ripple color="rgba(184, 212, 168, 0.2)" />
            </button>

            {/* Emoji Button */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                className={`relative flex items-center justify-center h-[44px] w-[36px] sm:w-[44px] sm:rounded-2xl rounded-xl text-text-muted hover:text-accent-primary hover:bg-accent-light transition-all active:scale-95 ripple-container ${showEmojiPicker ? 'text-accent-primary bg-accent-light' : ''}`}
                onClick={(e) => { e.preventDefault(); setShowEmojiPicker(p => !p); }}
                disabled={connectionStatus !== 'connected'}
                title="Add Emoji"
                aria-label="Add emoji"
              >
                <Smile size={20} />
                <Ripple color="rgba(184, 212, 168, 0.2)" />
              </button>
              {showEmojiPicker && (
                isMobile ? createPortal(
                  <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setShowEmojiPicker(false);
                      e.stopPropagation();
                    }}
                  >
                    <div ref={emojiPickerRef} className="bg-bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
                      <Suspense fallback={<div className="w-[300px] h-[350px] flex items-center justify-center"><Loader2 className="animate-spin text-text-muted text-accent-primary" /></div>}>
                        <EmojiPickerWrapper
                          onEmojiSelect={(data) => { onChatEmojiClick(data); setShowEmojiPicker(false); }}
                        />
                      </Suspense>
                    </div>
                  </div>,
                  document.body
                ) : (
                  <div className="absolute bottom-full left-0 mb-4 z-50">
                    <div ref={emojiPickerRef} className="bg-bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-fade-in origin-bottom-left">
                      <Suspense fallback={<div className="w-[300px] h-[350px] flex items-center justify-center"><Loader2 className="animate-spin text-text-muted text-accent-primary" /></div>}>
                        <EmojiPickerWrapper
                          onEmojiSelect={onChatEmojiClick}
                        />
                      </Suspense>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* CENTER TEXTAREA */}
          <div className="flex-1 min-w-[50px] max-w-full bg-bg-card border-2 border-border-subtle rounded-2xl focus-within:border-accent-primary transition-all shadow-soft">
            <textarea
              ref={messageInputRef}
              value={messageInput}
              onChange={(e) => {
                if (e.target.value.length <= 5000) setMessageInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
              disabled={connectionStatus !== 'connected'}
              rows={1}
              maxLength={5000}
              className="w-full px-3 py-3 sm:px-4 bg-transparent text-text-main placeholder-text-muted/60 outline-none resize-none max-h-32 min-h-[48px] scrollbar-thin scrollbar-thumb-bg-hover scrollbar-track-transparent text-sm sm:text-base"
              aria-label="Message input"
            />
            {messageInput.length > 4800 && (
              <div className={`px-3 pb-1 text-xs text-right ${messageInput.length >= 5000 ? 'text-red-400' : 'text-text-muted'}`}>
                {messageInput.length}/5000
              </div>
            )}
          </div>

          {/* RIGHT COMMAND CONTAINER (Send) */}
          <div className="flex flex-row items-end justify-end shrink-0 mb-[6px]">
            <button
              type="submit"
              disabled={connectionStatus !== 'connected' || (!messageInput.trim() && !selectedFile) || isUploading}
              className="relative flex items-center justify-center h-[44px] w-[40px] sm:w-[44px] sm:rounded-2xl rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary text-white shadow-soft hover:shadow-glow hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all flex-shrink-0 ripple-container"
              title="Send message"
              aria-label="Send message"
            >
              {connectionStatus === 'connecting' || isUploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              <Ripple color="rgba(255, 255, 255, 0.3)" />
            </button>
          </div>
        </div>
      </form>

      {/* --- SHARED REACTION TICKER POPUP --- */}
      {reactionPicker.isOpen && reactionPicker.coords && createPortal(
        <div
          className={isMobile ? "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" : "fixed z-[9999]"}
          style={isMobile ? {} : { 
            top: Math.max(10, reactionPicker.coords.top - 360) + 'px', 
            left: reactionPicker.isSentByMe ? Math.max(10, reactionPicker.coords.left - 300) + 'px' : Math.max(10, reactionPicker.coords.left) + 'px',
          }}
          onClick={(e) => {
            if (isMobile && e.target === e.currentTarget) {
              setReactionPicker((p) => ({ ...p, isOpen: false }));
            }
            e.stopPropagation();
          }}
        >
          <div ref={reactionPickerRef} className="bg-bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
            <Suspense fallback={<div className="w-[300px] h-[350px] bg-bg-card flex items-center justify-center"><Loader2 size={24} className="animate-spin text-text-muted" /></div>}>
              <EmojiPickerWrapper onEmojiSelect={handleReactionEmojiClick} />
            </Suspense>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default memo(ChatWindow);
