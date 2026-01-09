import { Capacitor, CapacitorHttp } from '@capacitor/core'; // CapacitorHttp EKLENDİ
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import semver from 'semver';

const GITHUB_USER = 'eminnates'; 
const GITHUB_REPO = 'Chatter';

export const checkAndroidUpdate = async (showToast) => {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    const appInfo = await App.getInfo();
    const currentVersion = appInfo.version;

    // 1. GitHub API URL
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`;

    // 2. Native HTTP İsteği (Axios yerine bunu kullanıyoruz)
    const options = {
      url: url,
      headers: { 
         'User-Agent': 'Chatter-App' // GitHub bazen User-Agent ister
      }
    };

    // Native istek atılıyor (CORS sorununu bypass eder)
    const response = await CapacitorHttp.get(options);

    // 3. Hata Kontrolü (Native HTTP hata fırlatmaz, status döner)
    if (response.status !== 200) {
        throw new Error(`GitHub API Hatası: ${response.status}`);
    }

    // CapacitorHttp veriyi 'data' içinde döndürür
    const latestRelease = response.data;
    const latestVersion = latestRelease.tag_name.replace('v', '');

    console.log('Mevcut:', currentVersion, 'GitHub:', latestVersion);

    if (semver.gt(latestVersion, currentVersion)) {
      const apkAsset = latestRelease.assets.find(asset => asset.name.endsWith('.apk'));
      
      if (apkAsset) {
        const confirmed = window.confirm(
          `Yeni Güncelleme Mevcut!\n\nv${latestVersion} indirilmeye hazır.\nGüncellemek ister misin?`
        );

        if (confirmed) {
          await Browser.open({ url: apkAsset.browser_download_url });
        }
      }
    } else {
      console.log('Uygulama güncel.');
    }

  } catch (error) {
    // Hatayı detaylı görelim
    alert('Güncelleme Hatası:\n' + JSON.stringify(error.message || error));
    console.error('Update hatası:', error);
  }
};