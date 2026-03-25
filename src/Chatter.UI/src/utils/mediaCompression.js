import imageCompression from 'browser-image-compression';

const IMAGE_MAX_SIZE_MB = 1;
const IMAGE_MAX_DIMENSION = 1920;
const VIDEO_MAX_SIZE_MB = 10;
const VIDEO_MAX_HEIGHT = 720;
const VIDEO_BITRATE = 1_500_000;

export async function compressImage(file) {
  if (file.size <= IMAGE_MAX_SIZE_MB * 1024 * 1024) return file;

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: IMAGE_MAX_SIZE_MB,
      maxWidthOrHeight: IMAGE_MAX_DIMENSION,
      useWebWorker: true,
    });
    return new File([compressed], file.name, { type: compressed.type || file.type });
  } catch (err) {
    console.error('Image compression failed:', err);
    return file;
  }
}

export async function compressVideo(file, onProgress) {
  if (file.size <= VIDEO_MAX_SIZE_MB * 1024 * 1024) return file;
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return file;

  try {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => { cleanup(); reject(new Error('Video load failed')); };
    });

    // Calculate target dimensions (max 720p, even numbers)
    const scale = Math.min(1, VIDEO_MAX_HEIGHT / video.videoHeight);
    const w = Math.round((video.videoWidth * scale) / 2) * 2;
    const h = Math.round((video.videoHeight * scale) / 2) * 2;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const canvasStream = canvas.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks()];

    // Try to extract audio
    let audioCtx, bufferSource;
    try {
      audioCtx = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      bufferSource = audioCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      const dest = audioCtx.createMediaStreamDestination();
      bufferSource.connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
    } catch {
      // No audio track or decoding failed — video only
    }

    const combinedStream = new MediaStream(tracks);
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITRATE,
    });

    return await new Promise((resolve) => {
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => { cleanup(); resolve(file); };

      recorder.onstop = () => {
        cleanup();
        try { bufferSource?.stop(); audioCtx?.close(); } catch {}
        const blob = new Blob(chunks, { type: 'video/webm' });
        if (blob.size >= file.size) { resolve(file); return; }
        const name = file.name.replace(/\.[^.]+$/, '.webm');
        resolve(new File([blob], name, { type: 'video/webm' }));
      };

      const drawFrame = () => {
        if (video.ended || video.paused) return;
        ctx.drawImage(video, 0, 0, w, h);
        if (onProgress && video.duration) {
          onProgress(Math.round((video.currentTime / video.duration) * 100));
        }
        requestAnimationFrame(drawFrame);
      };

      recorder.start(100);
      if (bufferSource) {
        video.addEventListener('playing', () => bufferSource.start(0), { once: true });
      }
      video.play().then(drawFrame).catch(() => { cleanup(); resolve(file); });

      video.onended = () => setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 200);

      // Timeout: max 2 minutes for compression
      setTimeout(() => {
        if (recorder.state === 'recording') {
          video.pause();
          recorder.stop();
        }
      }, 120_000);
    });
  } catch (err) {
    console.error('Video compression failed:', err);
    return file;
  }
}

export async function compressMedia(file, onProgress) {
  if (file.type.startsWith('image/')) return compressImage(file);
  if (file.type.startsWith('video/')) return compressVideo(file, onProgress);
  return file;
}
