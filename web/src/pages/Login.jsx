import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', displayName: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post(mode === 'login' ? '/auth/login' : '/auth/register', form);
      setUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-hero">
        <h1>✦ Tastemate</h1>
        <p>One taste profile for film, TV, music and books. Recommendations that explain themselves, plus lists and reviews from the friends whose taste you trust.</p>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <label>Username<input autoComplete="username" value={form.username} onChange={set('username')} required /></label>
        {mode === 'register' && (
          <label>Display name<input value={form.displayName} onChange={set('displayName')} placeholder="Optional" /></label>
        )}
        <label>
          Password
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : undefined} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Sign up'}</button>
        <p className="muted small">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}
