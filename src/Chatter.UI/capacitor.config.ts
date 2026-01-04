import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatter.app',
  appName: 'Chatter',
  webDir: 'dist',
  
  // ⚡ 1. Sunucu Ayarı (Geliştirme sırasında HTTPS sorunlarını çözer)
  server: {
    androidScheme: 'https',
    cleartext: true // Yerel ağ isteklerine izin ver
  },

  android: {
    // 🎨 2. Klavye açılırken arka planın siyah kalmasını sağlar (Beyaz flash'ı önler)
    backgroundColor: '#0a0e27', 
    allowMixedContent: true,
    // Klavye yeniden boyutlandırma modunu ayarlar
    minWebViewVersion: 50
  },

  plugins: {
    StatusBar: {
      // CSS'teki "env(safe-area-inset-top)" kodunun çalışması için bu ZORUNLU
      style: 'DARK',
      backgroundColor: '#0a0e27', // Sidebar rengiyle aynı olsun
      overlaysWebView: true // İçeriğin status bar altına girmesine izin ver (Modern görünüm)
    },
    
    Keyboard: {
      // "native": Viewport'u sıkıştırır (Chat input yukarı çıkar) - En iyisi bu
      // "body": Sadece body'yi sıkıştırır (Bazen input altta kalır)
      resize: 'native', 
      resizeOnFullScreen: true,
      style: 'DARK' // Klavye üzerindeki toolbar (varsa) koyu olsun
    },

    // 🚀 3. Splash Screen (Açılış Ekranı) Ayarları
    // Uygulama yüklenirken beyaz ekran yerine logoyu gösterir
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false, // App.js içinde biz manuel kapatacağız (Daha hızlı hissettirir)
      backgroundColor: "#0a0e27", // Tema rengin
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#B8D4A8", // Senin Fıstık Yeşili rengin
    },

    // Bildirimlerin ön planda da görünmesi için
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;