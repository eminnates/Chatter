import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const isNative = Capacitor.isNativePlatform();

export const storage = {
  async get(key) {
    if (isNative) {
      if (key === 'token' || key === 'refreshToken') {
        const value = await SecureStorage.get(key);
        return value || null;
      }
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },

  async set(key, value) {
    if (isNative) {
      if (key === 'token' || key === 'refreshToken') {
        await SecureStorage.set(key, value);
        return;
      }
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },

  async remove(key) {
    if (isNative) {
      if (key === 'token' || key === 'refreshToken') {
        await SecureStorage.remove(key);
        return;
      }
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },

  // Senkron okuma — sadece ilk yükleme için (localStorage fallback)
  getSync(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
};
