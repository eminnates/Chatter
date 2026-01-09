import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatter.app',
  appName: 'Chatter',
  webDir: 'dist',
  
  // ⚡ 1. Sunucu Ayarı
  server: {
    androidScheme: 'https',
    cleartext: true 
  },

  android: {
    // 🎨 2. Arka plan ayarları
    backgroundColor: '#0a0e27', 
    allowMixedContent: true,
    minWebViewVersion: 50
  },

  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e27', 
      overlaysWebView: true 
    },
    
    Keyboard: {
      resize: 'native', 
      resizeOnFullScreen: true,
      style: 'DARK' 
    },

    // 🚀 3. Splash Screen Ayarları
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false, 
      backgroundColor: "#0a0e27", 
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#B8D4A8", 
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }, // <--- BURAYA VİRGÜL EKLENDİ

    CapacitorHttp: {
      enabled: true // <--- "true" (string) YERİNE true (boolean) YAPILDI
    }
  }
};

export default config;