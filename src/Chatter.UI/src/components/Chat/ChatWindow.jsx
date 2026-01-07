import { useEffect, useRef } from 'react';
import { Menu, User, Phone, Video, Paperclip, X, Loader2, Send, Smile } from 'lucide-react';
import MessageItem from './MessageItem'; 
import Ripple from '../Common/Ripple';

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
  currentUserId 
}) => {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);

  // Auto scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on user change
  useEffect(() => {
    if (selectedUser && messageInputRef.current && !isMobile) {
      setTimeout(() => messageInputRef.current?.focus(), 100);
    }
  }, [selectedUser, isMobile]);

  // --- EMPTY STATE ---
  if (!selectedUser && !showProfilePage) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-bg-chat via-bg-main to-bg-chat text-center p-6 animate-fade-in">
        <div className="relative p-12 rounded-3xl bg-bg-card/50 border border-border backdrop-blur-xl shadow-2xl max-w-md w-full animate-scale-in">
          {/* Decorative circles */}
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
              Pick a friend from the sidebar and start a warm conversation! 💬
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showProfilePage) return null;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg-chat overflow-hidden">
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between px-4 py-3 bg-bg-sidebar/90 backdrop-blur-xl border-b border-border shadow-soft z-20">
         
         {/* Left: Menu + User Info */}
         <div className="flex items-center gap-3 overflow-hidden flex-1">
            {isMobile && (
              <button 
                onClick={onMobileMenuOpen} 
                className="relative p-2 -ml-1 rounded-xl text-accent-primary hover:bg-accent-light active:scale-95 transition-all ripple-container"
              >
                <Menu size={22} />
                <Ripple color="rgba(184, 212, 168, 0.3)" />
              </button>
            )}
            
            {/* Avatar + User Info - Clickable */}
            <div 
              onClick={onProfileView}
              className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer group hover:bg-accent-light/30 rounded-xl p-2 -ml-2 transition-all"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-semibold text-lg shadow-soft flex-shrink-0 group-hover:scale-105 transition-transform">
                {(selectedUser.fullName || selectedUser.userName)?.[0]?.toUpperCase()}
              </div>
              
              {/* Name & Status */}
              <div className="flex flex-col justify-center min-w-0">
                <h3 className="font-semibold text-text-main truncate text-base">
                  {selectedUser.fullName || selectedUser.userName}
                </h3>
                {isTyping ? (
                  <span className="text-xs text-accent-primary font-medium animate-pulse">
                    typing...
                  </span>
                ) : selectedUser.isOnline ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
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
            
            {/* Call Buttons */}
            <button 
                className="relative p-2.5 rounded-xl bg-bg-card hover:bg-accent-primary/10 text-accent-primary hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 ripple-container"
                onClick={() => onInitiateCall(selectedUser.id, 1)}
                disabled={callStatus !== 'idle'}
                title="Voice Call"
            >
                <Phone size={18} />
                <Ripple color="rgba(184, 212, 168, 0.3)" />
            </button>

            <button 
                className="relative p-2.5 rounded-xl bg-bg-card hover:bg-accent-warm/10 text-accent-warm hover:shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 ripple-container"
                onClick={() => onInitiateCall(selectedUser.id, 2)}
                disabled={callStatus !== 'idle'}
                title="Video Call"
            >
                <Video size={18} />
                <Ripple color="rgba(255, 140, 97, 0.3)" />
            </button>
         </div>
      </div>

      {/* --- MESSAGES --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-bg-hover hover:scrollbar-thumb-accent-primary/30 scrollbar-track-transparent">
        {messages.map((msg, i) => (
          <MessageItem
            key={msg.id || i}
            msg={msg}
            currentUserId={currentUserId}
            onImageClick={onImageClick}
          />
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
           <div className="flex items-center gap-2 p-3 w-fit bg-bg-card border border-border-subtle rounded-2xl rounded-tl-md shadow-soft animate-slide-up">
             <div className="flex items-center gap-1">
               <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
               <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
               <span className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
             </div>
             <span className="text-xs text-text-muted">typing</span>
           </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* --- INPUT AREA --- */}
      <form 
        className="relative p-3 bg-bg-sidebar/90 backdrop-blur-xl border-t border-border shadow-soft z-30" 
        onSubmit={sendMessage}
      >
         
         {/* Upload Progress Bar */}
         {isUploading && (
             <div className="absolute top-0 left-0 right-0 h-1 bg-accent-light/30 overflow-hidden">
                 <div 
                   className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-300 shadow-glow" 
                   style={{ width: `${uploadProgress}%` }}
                 ></div>
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
                    onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value=''; }}
                    className="relative p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 ripple-container flex-shrink-0"
                >
                    <X size={16} />
                    <Ripple color="rgba(239, 68, 68, 0.3)" />
                </button>
            </div>
         )}

         {/* Input Container */}
         <div className="flex items-end gap-2">
           {/* Hidden File Input */}
           <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
           />
           
           {/* Attach Button */}
           <button 
              type="button" 
              className="relative p-3 rounded-2xl text-text-muted hover:text-accent-primary hover:bg-accent-light transition-all active:scale-95 ripple-container flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File"
           >
              <Paperclip size={20} />
              <Ripple color="rgba(184, 212, 168, 0.2)" />
           </button>

           {/* Message Input */}
           <div className="flex-1 bg-bg-card border-2 border-border-subtle rounded-2xl focus-within:border-accent-primary transition-all shadow-soft">
              <textarea
                  ref={messageInputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(e);
                      }
                  }}
                  placeholder="Type a message..."
                  disabled={connectionStatus !== 'connected'}
                  rows={1}
                  className="w-full px-4 py-3 bg-transparent text-text-main placeholder-text-muted/60 outline-none resize-none max-h-32 min-h-[48px] scrollbar-thin scrollbar-thumb-bg-hover scrollbar-track-transparent"
              />
           </div>
          
          {/* Send Button */}
          <button 
              type="submit" 
              disabled={connectionStatus !== 'connected' || (!messageInput.trim() && !selectedFile)}
              className="relative p-3 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary text-white shadow-soft hover:shadow-glow hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center flex-shrink-0 ripple-container"
              title="Send message"
          >
              {connectionStatus === 'connecting' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              <Ripple color="rgba(255, 255, 255, 0.3)" />
          </button>
         </div>
      </form>
    </div>
  );
};

export default ChatWindow;