/**
 * Configuration utility for managing backend URLs and settings
 * Supports localStorage-based configuration with fallback to environment variables
 */

const CONFIG_STORAGE_KEY = 'chatter_config';
const URL_HISTORY_KEY = 'chatter_url_history';
const MAX_HISTORY_ITEMS = 5;

// Default values (can be overridden by environment variables)
const DEFAULT_CONFIG = {
  apiUrl: import.meta.env.VITE_API_URL || '',
  hubUrl: import.meta.env.VITE_HUB_URL || '',
  ngrokSkipWarning: true
};

/**
 * Validates if a URL is properly formatted
 */
export const validateUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Normalizes URL (adds protocol if missing, removes trailing slashes)
 */
export const normalizeUrl = (url) => {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, '');
  
  return normalized;
};

/**
 * Gets API URL from config
 * Automatically adds /api prefix if not present
 */
export const getApiUrl = () => {
  const config = getConfig();
  let url = config.apiUrl || DEFAULT_CONFIG.apiUrl;
  
  if (!url) return '';
  
  // Normalize URL first
  url = normalizeUrl(url);
  
  // If URL doesn't end with /api, add it
  if (!url.endsWith('/api')) {
    // Remove trailing slash if exists, then add /api
    url = url.replace(/\/+$/, '') + '/api';
  }
  
  return url;
};

/**
 * Gets Hub URL from config
 */
export const getHubUrl = () => {
  const config = getConfig();
  return config.hubUrl || DEFAULT_CONFIG.hubUrl;
};

/**
 * Gets full configuration
 */
export const getConfig = () => {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.error('Error reading config from localStorage:', error);
  }
  
  return { ...DEFAULT_CONFIG };
};

/**
 * Saves configuration
 * Note: API URL is saved without /api prefix (it's added automatically by getApiUrl)
 */
export const saveConfig = (config) => {
  try {
    let apiUrlToSave = normalizeUrl(config.apiUrl || '');
    
    // Remove /api suffix if user entered it (we'll add it automatically)
    apiUrlToSave = apiUrlToSave.replace(/\/api\/?$/, '');
    
    const configToSave = {
      apiUrl: apiUrlToSave,
      hubUrl: normalizeUrl(config.hubUrl || ''),
      ngrokSkipWarning: config.ngrokSkipWarning !== false
    };
    
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave));
    
    // Add to history if valid URL (save base URL without /api)
    if (configToSave.apiUrl && validateUrl(configToSave.apiUrl)) {
      addToUrlHistory(configToSave.apiUrl);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
};

/**
 * Gets URL history
 */
export const getUrlHistory = () => {
  try {
    const stored = localStorage.getItem(URL_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading URL history:', error);
  }
  
  return [];
};

/**
 * Adds URL to history
 */
const addToUrlHistory = (url) => {
  try {
    const history = getUrlHistory();
    const normalizedUrl = normalizeUrl(url);
    
    // Remove if already exists
    const filtered = history.filter(u => normalizeUrl(u) !== normalizedUrl);
    
    // Add to beginning
    filtered.unshift(normalizedUrl);
    
    // Keep only last N items
    const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving URL history:', error);
  }
};

/**
 * Clears URL history
 */
export const clearUrlHistory = () => {
  try {
    localStorage.removeItem(URL_HISTORY_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing URL history:', error);
    return false;
  }
};

/**
 * Tests connection to backend
 */
export const testBackendConnection = async (apiUrl) => {
  if (!apiUrl) {
    return { success: false, error: 'URL is required' };
  }
  
  const normalizedUrl = normalizeUrl(apiUrl);
  
  if (!validateUrl(normalizedUrl)) {
    return { success: false, error: 'Invalid URL format' };
  }
  
  try {
    // Ensure /api prefix is present
    let testUrl = normalizedUrl;
    if (!testUrl.endsWith('/api')) {
      testUrl = testUrl.replace(/\/+$/, '') + '/api';
    }
    testUrl = `${testUrl}/auth/login`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Even if login fails, if we get a response, the backend is reachable
    if (response.status === 400 || response.status === 401 || response.status === 404) {
      // These status codes mean the server is reachable
      return { success: true, message: 'Backend is reachable' };
    }
    
    if (response.ok) {
      return { success: true, message: 'Backend connection successful' };
    }
    
    return { success: false, error: `Backend returned status ${response.status}` };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Connection timeout' };
    }
    
    return { success: false, error: error.message || 'Failed to connect to backend' };
  }
};

/**
 * Auto-detects hub URL from API URL
 */
export const autoDetectHubUrl = (apiUrl) => {
  if (!apiUrl) return '';
  
  const normalized = normalizeUrl(apiUrl);
  
  // Remove /api if present
  const baseUrl = normalized.replace(/\/api\/?$/, '');
  
  // Add /hubs/chat
  return `${baseUrl}/hubs/chat`;
};

/**
 * Resets config to defaults
 */
export const resetConfig = () => {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error resetting config:', error);
    return false;
  }
};

