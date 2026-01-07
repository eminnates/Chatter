import React, { useEffect, useState } from 'react';
import { Minus, Square, X, MessageCircle, Maximize2 } from 'lucide-react';

const TitleBar = ({ appName = "Chatter" }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Electron kontrolü
    const electron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
    setIsElectron(electron);

    // Maximize durumunu dinle
    if (electron && window.electronAPI?.onMaximizeChange) {
      window.electronAPI.onMaximizeChange((maximized) => {
        setIsMaximized(maximized);
      });
    }
  }, []);

  // Eğer Electron değilse, TitleBar'ı gösterme
  if (!isElectron) return null;

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
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