import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

const AppUpdater = registerPlugin('AppUpdater');

// Simple semver comparison — replaces the full semver package (~288KB)
const semverGt = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
};

const GITHUB_USER = 'eminnates';
const GITHUB_REPO = 'Chatter';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Check for updates — returns update info without showing any UI
 */
export const checkForUpdate = async () => {
  if (Capacitor.getPlatform() !== 'android') return { hasUpdate: false };

  try {
    const appInfo = await App.getInfo();
    const currentVersion = appInfo.version;

    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`;

    const response = await CapacitorHttp.get({
      url,
      headers: { 'User-Agent': 'Chatter-App' }
    });

    if (response.status !== 200) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const latestRelease = response.data;
    const latestVersion = latestRelease.tag_name.replace('v', '');

    console.log('Current:', currentVersion, 'Latest:', latestVersion);

    if (semverGt(latestVersion, currentVersion)) {
      const apkAsset = latestRelease.assets.find(asset => asset.name.endsWith('.apk'));

      if (apkAsset) {
        return {
          hasUpdate: true,
          currentVersion,
          latestVersion,
          releaseNotes: latestRelease.body || '',
          apkUrl: apkAsset.browser_download_url,
          apkSize: apkAsset.size,
          apkSizeFormatted: formatBytes(apkAsset.size),
        };
      }
    }

    console.log('App is up to date.');
    return { hasUpdate: false };

  } catch (error) {
    console.error('Update check error:', error);
    return { hasUpdate: false, error: error.message };
  }
};

/**
 * Download and install APK update
 * @param {string} apkUrl - Direct download URL for the APK
 * @param {function} onProgress - Callback: (percent, bytesDownloaded, totalBytes) => void
 * @returns {Promise<void>}
 */
export const downloadAndInstallUpdate = async (apkUrl, onProgress) => {
  // Check install permission first
  const permResult = await AppUpdater.checkInstallPermission();

  if (!permResult.granted) {
    await AppUpdater.requestInstallPermission();
    throw new Error('PERMISSION_NEEDED');
  }

  // Listen for download progress events
  const progressListener = await AppUpdater.addListener('downloadProgress', (data) => {
    if (onProgress) {
      onProgress(data.percent, data.bytesDownloaded, data.totalBytes);
    }
  });

  try {
    await AppUpdater.downloadAndInstall({ url: apkUrl });
  } finally {
    progressListener.remove();
  }
};

export { formatBytes };
