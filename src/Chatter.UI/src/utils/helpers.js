import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Deterministic avatar gradient from user ID (stable across sessions)
const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-pink-500 to-fuchsia-600',
  'from-amber-400 to-orange-500',
  'from-sky-500 to-blue-600',
  'from-green-500 to-emerald-600',
  'from-red-500 to-rose-600',
  'from-indigo-500 to-violet-600',
];

export const avatarGradient = (userId) => {
  if (!userId) return AVATAR_GRADIENTS[0];
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

export const triggerHaptic = async (style = ImpactStyle.Light) => {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.impact({ style }); } catch (e) { console.log('Haptics not available'); }
  }
};


// === CALL TYPE HELPER ===
export const isVideoCallType = (call) => {
  if (!call) return false;
  return call.type === 2 || call.type === 'Video' || call.type === 'video';
};

// === SOUND EFFECTS ===
export const createSoundEffect = (frequency, duration, type = 'sine', volume = 0.3) => {
  return () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = type
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration)
    } catch (err) {
      console.log('Sound not supported:', err)
    }
  }
}
export const sounds = {
  messageSent: () => {
    const play = createSoundEffect(440, 0.15, 'sine', 0.2)
    play()
    setTimeout(() => createSoundEffect(587, 0.1, 'sine', 0.15)(), 50)
  },
  messageReceived: () => {
    const play = createSoundEffect(587, 0.12, 'sine', 0.25)
    play()
    setTimeout(() => createSoundEffect(440, 0.15, 'sine', 0.2)(), 60)
  },
  notification: () => {
    createSoundEffect(523, 0.2, 'sine', 0.2)()
    setTimeout(() => createSoundEffect(659, 0.25, 'sine', 0.15)(), 100)
  },
  connect: () => {
    createSoundEffect(392, 0.1, 'sine', 0.15)()
    setTimeout(() => createSoundEffect(523, 0.1, 'sine', 0.15)(), 80)
    setTimeout(() => createSoundEffect(659, 0.15, 'sine', 0.2)(), 160)
  }
}