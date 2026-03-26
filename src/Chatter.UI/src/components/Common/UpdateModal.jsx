import { Download, Loader2, CheckCircle, AlertCircle, ArrowRight, X, RefreshCw } from 'lucide-react';
import { formatBytes } from '../../utils/androidUpdater';
import Ripple from './Ripple';

const UpdateModal = ({ updateInfo, status, progress, onUpdate, onClose, errorMessage }) => {
  if (!updateInfo) return null;

  const { currentVersion, latestVersion, releaseNotes, apkSizeFormatted } = updateInfo;

  const isIdle = status === 'idle';
  const isDownloading = status === 'downloading';
  const isDownloaded = status === 'downloaded';
  const isInstalling = status === 'installing';
  const isError = status === 'error';

  const canClose = isIdle || isError || isDownloaded;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-6 animate-fade-in">
      <div className="relative bg-bg-card border border-border rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in overflow-hidden">

        {/* Decorative gradient backgrounds */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent-purple/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10">

          {/* Close button */}
          {canClose && (
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 rounded-xl text-text-subtle hover:text-text-muted hover:bg-bg-hover transition-colors"
            >
              <X size={20} />
            </button>
          )}

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className={`
                w-20 h-20 rounded-full flex items-center justify-center shadow-soft-lg
                ${isError
                  ? 'bg-gradient-to-br from-accent-warm to-accent-coral'
                  : isDownloaded
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                    : 'bg-gradient-to-br from-accent-primary to-accent-purple'
                }
              `}>
                {isIdle && <Download size={36} className="text-white" />}
                {isDownloading && <Loader2 size={36} className="text-white animate-spin" />}
                {isDownloaded && <CheckCircle size={36} className="text-white" />}
                {isInstalling && <Loader2 size={36} className="text-white animate-spin" />}
                {isError && <AlertCircle size={36} className="text-white" />}
              </div>

              {/* Pulse ring for idle state */}
              {isIdle && (
                <div className="absolute inset-0 rounded-full bg-accent-primary/20 animate-ping" />
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-text-main mb-2">
            {isIdle && 'Yeni Guncelleme!'}
            {isDownloading && 'Indiriliyor...'}
            {isDownloaded && 'Indirme Tamamlandi'}
            {isInstalling && 'Kuruluyor...'}
            {isError && 'Guncelleme Hatasi'}
          </h2>

          {/* Version info */}
          {!isError && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-bg-hover text-text-muted text-sm font-medium">
                v{currentVersion}
              </span>
              <ArrowRight size={16} className="text-accent-primary" />
              <span className="px-3 py-1 rounded-full bg-accent-primary/15 text-accent-primary text-sm font-bold">
                v{latestVersion}
              </span>
            </div>
          )}

          {/* Progress bar (downloading state) */}
          {isDownloading && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-text-muted">
                  {progress.bytesDownloaded && progress.totalBytes
                    ? `${formatBytes(progress.bytesDownloaded)} / ${formatBytes(progress.totalBytes)}`
                    : 'Baslatiliyor...'
                  }
                </span>
                <span className="text-sm font-bold text-accent-primary">
                  %{progress.percent || 0}
                </span>
              </div>
              <div className="h-3 rounded-full bg-bg-hover overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-purple transition-all duration-300 ease-out"
                  style={{ width: `${progress.percent || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Release notes (idle state) */}
          {isIdle && releaseNotes && (
            <div className="mb-6 max-h-32 overflow-y-auto rounded-xl bg-bg-main/50 border border-border-subtle p-3">
              <p className="text-sm text-text-muted whitespace-pre-line leading-relaxed">
                {releaseNotes}
              </p>
            </div>
          )}

          {/* Idle: file size info */}
          {isIdle && apkSizeFormatted && (
            <p className="text-center text-sm text-text-subtle mb-6">
              Dosya boyutu: {apkSizeFormatted}
            </p>
          )}

          {/* Downloaded state info */}
          {isDownloaded && (
            <p className="text-center text-sm text-text-muted mb-6">
              Indirme tamamlandi. Kurulumu baslatmak icin asagidaki butona basin.
            </p>
          )}

          {/* Installing state info */}
          {isInstalling && (
            <p className="text-center text-sm text-text-muted mb-6">
              Kurulum ekrani aciliyor...
            </p>
          )}

          {/* Error message */}
          {isError && (
            <p className="text-center text-sm text-accent-warm mb-6">
              {errorMessage || 'Guncelleme sirasinda bir hata olustu.'}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {/* Idle: Update + Later */}
            {isIdle && (
              <>
                <button
                  onClick={onUpdate}
                  className="relative w-full py-4 font-bold text-white rounded-xl bg-gradient-to-r from-accent-primary to-accent-purple hover:to-accent-warm shadow-lg hover:shadow-accent-primary/40 active:scale-95 transition-all duration-300 ripple-container"
                >
                  Guncelle
                  <Ripple color="rgba(184, 212, 168, 0.3)" />
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 text-sm font-medium text-text-muted border border-border-subtle rounded-xl hover:bg-bg-hover hover:text-text-main transition-all duration-300"
                >
                  Daha Sonra
                </button>
              </>
            )}

            {/* Downloaded: Install + Cancel */}
            {isDownloaded && (
              <>
                <button
                  onClick={onUpdate}
                  className="relative w-full py-4 font-bold text-white rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg active:scale-95 transition-all duration-300 ripple-container"
                >
                  Kur
                  <Ripple color="rgba(34, 197, 94, 0.3)" />
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 text-sm font-medium text-text-muted border border-border-subtle rounded-xl hover:bg-bg-hover hover:text-text-main transition-all duration-300"
                >
                  Iptal
                </button>
              </>
            )}

            {/* Error: Retry + Close */}
            {isError && (
              <>
                <button
                  onClick={onUpdate}
                  className="relative w-full py-4 font-bold text-white rounded-xl bg-gradient-to-r from-accent-primary to-accent-purple hover:to-accent-warm shadow-lg active:scale-95 transition-all duration-300 ripple-container flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} />
                  Tekrar Dene
                  <Ripple color="rgba(184, 212, 168, 0.3)" />
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 text-sm font-medium text-text-muted border border-border-subtle rounded-xl hover:bg-bg-hover hover:text-text-main transition-all duration-300"
                >
                  Kapat
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
