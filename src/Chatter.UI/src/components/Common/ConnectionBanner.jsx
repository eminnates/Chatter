import { memo } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const ConnectionBanner = memo(({ connectionStatus, isNetworkOnline, onRetry }) => {
  if (connectionStatus === 'connected' && isNetworkOnline) return null;

  const isReconnecting = connectionStatus === 'reconnecting';
  const isOffline = !isNetworkOnline;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium transition-all duration-300 ${
        isOffline
          ? 'bg-red-500/15 text-red-400 border-b border-red-500/20'
          : isReconnecting
          ? 'bg-yellow-500/15 text-yellow-400 border-b border-yellow-500/20'
          : 'bg-red-500/15 text-red-400 border-b border-red-500/20'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {isReconnecting ? (
          <Loader2 size={13} className="animate-spin shrink-0" />
        ) : (
          <WifiOff size={13} className="shrink-0" />
        )}
        <span>
          {isOffline
            ? 'İnternet bağlantısı yok'
            : isReconnecting
            ? 'Yeniden bağlanıyor...'
            : 'Bağlantı kesildi'}
        </span>
      </div>

      {!isReconnecting && onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-current/30 hover:bg-current/10 transition-colors"
          aria-label="Yeniden bağlan"
        >
          <Wifi size={11} />
          Bağlan
        </button>
      )}
    </div>
  );
});

ConnectionBanner.displayName = 'ConnectionBanner';

export default ConnectionBanner;
