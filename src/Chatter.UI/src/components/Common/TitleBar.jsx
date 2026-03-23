import React, { useEffect, useState } from 'react';
import { Minus, Square, X, MessageCircle, Maximize2 } from 'lucide-react';
import { Window } from '@tauri-apps/api/window';
import { isTauri } from '@tauri-apps/api/core';

const TitleBar = ({ appName = "Chatter" }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Desktop environment check
    const checkDesktop = async () => {
      if (isTauri()) {
        setIsDesktop(true);
        const appWindow = Window.getCurrent();
        
        // Listen to resize events
        appWindow.onResized(async () => {
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
        });
      }
    };
    
    checkDesktop();
  }, []);

  // Show TitleBar only on desktop via Tauri
  if (!isDesktop) return null;

  const handleMinimize = () => {
     Window.getCurrent()?.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = Window.getCurrent();
    if (appWindow) {
        await appWindow.toggleMaximize();
    }
  };

  const handleClose = () => {
     Window.getCurrent()?.close();
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-8 bg-bg-sidebar border-b border-border-subtle flex items-center justify-between z-[9999] app-drag-region">
      {/* Left: App Icon & Name */}
      <div className="flex items-center gap-2 px-3 no-drag">
        <MessageCircle size={16} className="text-accent-primary" />
        <span className="text-sm font-medium text-text-main select-none">{appName}</span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center no-drag">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="h-8 w-12 flex items-center justify-center hover:bg-bg-hover transition-colors group"
          title="Minimize"
          aria-label="Minimize window"
        >
          <Minus size={16} className="text-text-muted group-hover:text-text-main transition-colors" />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="h-8 w-12 flex items-center justify-center hover:bg-bg-hover transition-colors group"
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
        >
          {isMaximized ? (
            <Maximize2 size={14} className="text-text-muted group-hover:text-text-main transition-colors" />
          ) : (
            <Square size={14} className="text-text-muted group-hover:text-text-main transition-colors" />
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-8 w-12 flex items-center justify-center hover:bg-red-500 transition-colors group"
          title="Close"
          aria-label="Close window"
        >
          <X size={16} className="text-text-muted group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;