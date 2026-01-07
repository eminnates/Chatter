import React, { useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import SecureImage from './SecureImage';

const Lightbox = ({ image, onClose }) => {
  // ESC tuşu ile kapatma
  useEffect(() => {
    if (!image) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    // Body scroll'u engelle
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [image, onClose]);

  if (!image) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image;
    link.download = `image-${Date.now()}.jpg`;
    link.click();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-sm">ESC to close</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Download Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
            title="Download"
          >
            <Download size={20} />
          </button>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors backdrop-blur-sm"
            title="Close (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div 
        className="relative max-w-7xl max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <SecureImage 
          src={image} 
          alt="Full size preview"
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
        />
      </div>

      {/* Bottom Info (Optional) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
        <p className="text-center text-white/70 text-sm">
          Click outside or press ESC to close
        </p>
      </div>
    </div>
  );
};

export default Lightbox;