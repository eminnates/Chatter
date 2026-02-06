// 🚀 Backend URL Configuration
// Priority: VITE_BACKEND_URL env variable > production default > localhost
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.MODE === 'production' 
    ? 'https://chatter-7q0c.onrender.com'
    : 'http://localhost:5000');

export { BACKEND_URL };
export const API_URL = `${BACKEND_URL}/api`;
export const HUB_URL = `${BACKEND_URL}/hubs/chat`;

console.log('🔗 Backend URL:', BACKEND_URL);
