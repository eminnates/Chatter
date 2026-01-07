import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import logoImage from '../../assets/logo.png';
import { API_URL } from '../../config/constants';
import Toast from '../Common/Toast'; // Yeni oluşturduğumuz Toast bileşeni

const AuthScreen = ({ onAuthSuccess }) => {
  // --- STATE ---
  const [isRegistering, setIsRegistering] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    userName: '',
    email: '',
    password: '',
    fullName: ''
  });

  // --- REFS ---
  const loginEmailRef = useRef(null);
  const registerUsernameRef = useRef(null);

  // --- HELPER ---
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Auto-focus logic
  useEffect(() => {
    setTimeout(() => {
      if (isRegistering) {
        registerUsernameRef.current?.focus();
      } else {
        loginEmailRef.current?.focus();
      }
    }, 100);
  }, [isRegistering]);

  // --- LOGIN ---
  const login = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, loginForm);
      onAuthSuccess(data);
    } catch (error) {
      const errorData = error.response?.data;
      let errorMessage = 'Invalid email or password.';
      
      if (errorData?.error?.message) errorMessage = errorData.error.message;
      else if (errorData?.message) errorMessage = errorData.message;
      
      showToast(errorMessage, 'error');
    }
  };

  // --- REGISTER ---
  const register = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, registerForm);
      
      if (!data.token && !data.data?.token && !data.accessToken) {
        showToast('Account created! Logging you in...', 'success');
        try {
          const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: registerForm.email,
            password: registerForm.password
          });
          onAuthSuccess(loginResponse.data);
        } catch (loginError) {
          showToast('Account created! Please login.', 'success');
          setIsRegistering(false);
        }
      } else {
        onAuthSuccess(data);
      }
    } catch (error) {
      const errorData = error.response?.data;
      let errorMessage = 'Registration failed.';
      
      if (errorData?.message) errorMessage = errorData.message;
      
      showToast(errorMessage, 'error');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg-main relative overflow-hidden p-6">
      
      {/* --- ARKA PLAN EFEKTLERİ (Tailwind ile) --- */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent-primary/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent-warm/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: '1s' }}></div>

      {/* --- TOAST --- */}
      <Toast toast={toast} />

      {/* --- LOGIN KUTUSU --- */}
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 bg-bg-sidebar/60 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl animate-slide-up">
        
        {/* LOGO */}
        <div className="flex justify-center mb-8">
          <img 
            src={logoImage} 
            alt="Chatter Logo" 
            className="h-20 w-auto drop-shadow-[0_0_15px_rgba(184,212,168,0.4)]" 
          />
        </div>

        {/* BAŞLIK */}
        <h2 className="mb-8 text-center text-3xl font-bold bg-gradient-to-r from-accent-primary via-accent-purple to-accent-warm bg-clip-text text-transparent">
          {isRegistering ? 'Join the Party 🎉' : 'Welcome Back 👋'}
        </h2>

        {/* FORM */}
        <form onSubmit={isRegistering ? register : login} className="flex flex-col gap-4">
          {isRegistering ? (
            <>
              <input 
                ref={registerUsernameRef}
                type="text" 
                placeholder="Username" 
                value={registerForm.userName} 
                onChange={e => setRegisterForm(prev => ({ ...prev, userName: e.target.value }))} 
                required 
                className="w-full px-5 py-3.5 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300"
              />
              <input 
                type="text" 
                placeholder="Full Name" 
                value={registerForm.fullName} 
                onChange={e => setRegisterForm(prev => ({ ...prev, fullName: e.target.value }))} 
                className="w-full px-5 py-3.5 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300"
              />
              <input 
                type="email" 
                placeholder="Email" 
                value={registerForm.email} 
                onChange={e => setRegisterForm(prev => ({ ...prev, email: e.target.value }))} 
                required 
                className="w-full px-5 py-3.5 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={registerForm.password} 
                onChange={e => setRegisterForm(prev => ({ ...prev, password: e.target.value }))} 
                required 
                className="w-full px-5 py-3.5 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300"
              />
            </>
          ) : (
            <>
              <input 
                ref={loginEmailRef}
                type="email" 
                placeholder="Email" 
                value={loginForm.email} 
                onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))} 
                required 
                className="w-full px-5 py-3.5 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300"
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={loginForm.password} 
                onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))} 
                required 
                className="w-full px-5 py-3.5 bg-bg-main border border-white/5 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300"
              />
            </>
          )}

          {/* BUTON */}
          <button 
            type="submit"
            className="w-full mt-4 py-4 font-bold text-white rounded-xl bg-gradient-to-r from-accent-primary to-accent-purple hover:to-accent-warm shadow-lg hover:shadow-accent-primary/40 active:scale-95 transition-all duration-300 transform"
          >
            {isRegistering ? 'Get Started ✨' : 'Let\'s Go! 🚀'}
          </button>

          {/* TOGGLE LINK */}
          <p 
            onClick={() => setIsRegistering(!isRegistering)}
            className="mt-4 text-center text-sm text-text-muted cursor-pointer hover:text-accent-primary hover:underline transition-colors"
          >
            {isRegistering ? 'Already have an account? Sign in here' : "New here? Create an account"}
          </p>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;