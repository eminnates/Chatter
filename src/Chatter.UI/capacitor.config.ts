import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatter.app',
  appName: 'Chatter',
  webDir: 'dist',
  android: {
    // Enable edge-to-edge display
    backgroundColor: '#0a0e27',
    allowMixedContent: true,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e27',
      overlaysWebView: true
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true
    }
  }
};

export default config;
