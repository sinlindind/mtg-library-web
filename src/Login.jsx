import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [view, setView] = useState('signin'); // 'signin', 'signup', or 'reset'
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (view === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            username: username.trim(),
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage('Account created! Check your email to confirm registration.');
      }
    } else if (view === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMessage(error.message);
      }
    } else if (view === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage('Password reset link sent! Check your email inbox.');
      }
    }

    setLoading(false);
  };

  const changeView = (newView) => {
    setView(newView);
    setErrorMessage('');
    setSuccessMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-center text-slate-800 dark:text-slate-100">
          {view === 'signup' && 'Create Account'}
          {view === 'signin' && 'Sign In'}
          {view === 'reset' && 'Reset Password'}
        </h2>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Username
              </label>
              <input
                type="text"
                value={username}
                required={view === 'signup'}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="johndoe"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          {view !== 'reset' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                {view === 'signin' && (
                  <button
                    type="button"
                    onClick={() => changeView('reset')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                required={view !== 'reset'}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow transition-colors disabled:opacity-50"
          >
            {loading ? (
              'Processing...'
            ) : (
              <>
                {view === 'signup' && 'Sign Up'}
                {view === 'signin' && 'Sign In'}
                {view === 'reset' && 'Send Reset Link'}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
          {view === 'reset' ? (
            <div>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => changeView('signin')}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div>
              {view === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => changeView(view === 'signup' ? 'signin' : 'signup')}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {view === 'signup' ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}