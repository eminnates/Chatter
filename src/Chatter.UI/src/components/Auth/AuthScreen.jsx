import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Mail, User, Lock, Loader2 } from 'lucide-react';
import logoImage from '../../assets/logo.png';
import { API_URL } from '../../config/constants';
import Toast from '../Common/Toast';

const AuthScreen = ({ onAuthSuccess }) => {
  // --- STATE ---
  const [isRegistering, setIsRegistering] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

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

  // --- HELPERS ---
  const inputBase = "w-full py-3.5 bg-bg-main border border-border-subtle rounded-xl text-text-main placeholder-text-muted/60 focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all duration-300";

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const toggleMode = () => {
    setIsRegistering(prev => !prev);
    setShowLoginPassword(false);
    setShowRegisterPassword(false);
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, loginForm);
      onAuthSuccess(data);
    } catch (error) {
      const errorData = error.response?.data;
      let errorMessage = 'Invalid email or password.';

      if (errorData?.error?.message) errorMessage = errorData.error.message;
      else if (errorData?.message) errorMessage = errorData.message;

      showToast(errorMessage, 'error');
      setLoginForm(prev => ({ ...prev, password: '' }));
      setShowLoginPassword(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- REGISTER ---
  const register = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
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
          setRegisterForm(prev => ({ ...prev, password: '' }));
          setShowRegisterPassword(false);
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
      setRegisterForm(prev => ({ ...prev, password: '' }));
      setShowRegisterPassword(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg-main relative overflow-hidden p-6">

      {/* Background effects */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-accent-primary/20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-accent-warm/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 -right-12 w-72 h-72 bg-accent-purple/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Toast */}
      <Toast toast={toast} />

      {/* Auth card */}
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 bg-bg-sidebar/95 backdrop-blur-xl border border-border-subtle rounded-3xl shadow-2xl animate-slide-up">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src={logoImage}
            alt="Chatter Logo"
            className="h-20 w-auto drop-shadow-[0_0_15px_rgba(184,212,168,0.4)]"
          />
        </div>

        {/* Title */}
        <h2 className="text-center text-3xl font-bold bg-gradient-to-r from-accent-primary via-accent-purple to-accent-warm bg-clip-text text-transparent">
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-center text-sm text-text-muted mt-2 mb-8">
          {isRegistering ? 'Fill in your details to get started' : 'Sign in to continue to Chatter'}
        </p>

        {/* Form */}
        <form onSubmit={isRegistering ? register : login}>
          <div key={isRegistering ? 'register' : 'login'} className="flex flex-col gap-3.5 animate-fade-in">
            {isRegistering ? (
              <>
                {/* Username */}
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    ref={registerUsernameRef}
                    type="text"
                    placeholder="Username"
                    value={registerForm.userName}
                    onChange={e => setRegisterForm(prev => ({ ...prev, userName: e.target.value }))}
                    required
                    autoComplete="username"
                    className={`${inputBase} pl-11 pr-5`}
                  />
                </div>

                {/* Full Name */}
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={registerForm.fullName}
                    onChange={e => setRegisterForm(prev => ({ ...prev, fullName: e.target.value }))}
                    autoComplete="name"
                    className={`${inputBase} pl-11 pr-5`}
                  />
                </div>

                {/* Email */}
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={registerForm.email}
                    onChange={e => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    autoComplete="email"
                    className={`${inputBase} pl-11 pr-5`}
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={registerForm.password}
                    onChange={e => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    autoComplete="new-password"
                    className={`${inputBase} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(prev => !prev)}
                    tabIndex={-1}
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-subtle hover:text-text-muted transition-colors"
                  >
                    {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Email */}
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    ref={loginEmailRef}
                    type="email"
                    placeholder="Email"
                    value={loginForm.email}
                    onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                    autoComplete="email"
                    className={`${inputBase} pl-11 pr-5`}
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                    className={`${inputBase} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(prev => !prev)}
                    tabIndex={-1}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-subtle hover:text-text-muted transition-colors"
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 py-4 font-bold text-white rounded-xl bg-gradient-to-r from-accent-primary to-accent-purple hover:to-accent-warm shadow-lg hover:shadow-accent-primary/40 active:scale-95 transition-all duration-300 transform disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isSubmitting ? (
              <Loader2 size={20} className="animate-spin mx-auto" />
            ) : (
              isRegistering ? 'Create Account' : 'Sign In'
            )}
          </button>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border-subtle" />
            <span className="text-xs text-text-subtle">or</span>
            <div className="flex-1 h-px bg-border-subtle" />
          </div>

          {/* Mode toggle */}
          <button
            type="button"
            onClick={toggleMode}
            className="mt-4 w-full py-3 text-sm font-medium text-text-muted border border-border-subtle rounded-xl hover:bg-bg-hover hover:text-accent-primary hover:border-accent-primary/30 transition-all duration-300"
          >
            {isRegistering ? 'Already have an account? Sign In' : 'New here? Create an Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
