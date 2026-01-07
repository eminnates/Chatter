import React from 'react';
import { Info, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const Toast = ({ toast }) => {
  if (!toast) return null;

  const { message, type = 'info' } = toast;

  // Tip'e göre renkler ve ikonlar
  const styles = {
    success: {
      bg: 'bg-gradient-to-r from-accent-primary to-accent-secondary',
      text: 'text-white',
      icon: <CheckCircle2 size={20} />,
      iconBg: 'bg-white/20'
    },
    error: {
      bg: 'bg-gradient-to-r from-accent-warm to-accent-coral',
      text: 'text-white',
      icon: <XCircle size={20} />,
      iconBg: 'bg-white/20'
    },
    warning: {
      bg: 'bg-gradient-to-r from-accent-coral to-accent-warm',
      text: 'text-white',
      icon: <AlertCircle size={20} />,
      iconBg: 'bg-white/20'
    },
    info: {
      bg: 'bg-gradient-to-r from-accent-purple to-accent-primary',
      text: 'text-white',
      icon: <Info size={20} />,
      iconBg: 'bg-white/20'
    }
  };

  const currentStyle = styles[type] || styles.info;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-slide-down">
      <div className={`${currentStyle.bg} ${currentStyle.text} rounded-2xl shadow-soft-lg px-4 py-3 flex items-center gap-3 max-w-md min-w-[280px] backdrop-blur-sm`}>
        {/* Icon */}
        <div className={`${currentStyle.iconBg} rounded-full p-2 flex items-center justify-center flex-shrink-0`}>
          {currentStyle.icon}
        </div>
        
        {/* Message */}
        <span className="text-sm font-medium flex-1 leading-relaxed">
          {message}
        </span>
      </div>
    </div>
  );
};

export default Toast;