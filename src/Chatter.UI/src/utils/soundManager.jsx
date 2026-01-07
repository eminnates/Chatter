export const createSoundEffect = (frequency, duration, type = 'sine', volume = 0.3) => {
  return () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (err) {
      console.error('Sound error', err);
    }
  }
}

export const sounds = {
  messageSent: () => { 
    const play = createSoundEffect(440, 0.15, 'sine', 0.2); 
    play(); 
    setTimeout(() => createSoundEffect(587, 0.1, 'sine', 0.15)(), 50); 
  },
  messageReceived: () => { 
    const play = createSoundEffect(587, 0.12, 'sine', 0.25); 
    play(); 
    setTimeout(() => createSoundEffect(440, 0.15, 'sine', 0.2)(), 60); 
  },
  notification: () => { 
    createSoundEffect(523, 0.2, 'sine', 0.2)(); 
    setTimeout(() => createSoundEffect(659, 0.25, 'sine', 0.15)(), 100); 
  },
  connect: () => { 
    createSoundEffect(392, 0.1, 'sine', 0.15)(); 
    setTimeout(() => createSoundEffect(523, 0.1, 'sine', 0.15)(), 80); 
    setTimeout(() => createSoundEffect(659, 0.15, 'sine', 0.2)(), 160); 
  }
};