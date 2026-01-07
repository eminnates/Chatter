import { useState, useEffect, memo } from 'react';
import { Loader, ImageOff } from 'lucide-react';

const SecureImage = memo(({ src, alt, className, onClick }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    
    let isMounted = true;
    setLoading(true);
    setError(false);

    fetch(src, { 
      headers: { 'ngrok-skip-browser-warning': 'true' } 
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to load image');
        return response.blob();
      })
      .then(blob => {
        if (isMounted) {
          const objectUrl = URL.createObjectURL(blob);
          setImageSrc(objectUrl);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('SecureImage load error:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [src]);

  // Loading State - Skeleton with spinner
  if (loading) {
    return (
      <div 
        className={`${className} flex items-center justify-center bg-accent-light rounded-lg skeleton overflow-hidden relative`}
        style={{ minHeight: '100px' }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        <Loader size={24} className="text-accent-primary animate-spin z-10" />
      </div>
    );
  }

  // Error State - Friendly error message
  if (error) {
    return (
      <div 
        className={`${className} flex flex-col items-center justify-center bg-accent-warm/10 rounded-lg border-2 border-dashed border-accent-warm/30 transition-colors hover:bg-accent-warm/15`}
        style={{ minHeight: '100px' }}
      >
        <ImageOff size={32} className="text-accent-warm mb-2 opacity-70" />
        <span className="text-xs text-text-muted">Resim yüklenemedi</span>
      </div>
    );
  }

  // Success State - Image loaded
  return (
    <img 
      src={imageSrc} 
      alt={alt} 
      className={`${className} transition-all duration-300 hover:scale-[1.02]`}
      onClick={onClick}
      loading="lazy"
    />
  );
});

SecureImage.displayName = 'SecureImage';

export default SecureImage;