'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveSession } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [role, setRole] = useState('PASSENGER');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      const body =
        mode === 'signup'
          ? { name: form.name, email: form.email, password: form.password, role }
          : { email: form.email, password: form.password };
      const data = await api(path, { method: 'POST', body });
      saveSession(data.token, data.user);
      router.push(data.user.role === 'DRIVER' ? '/driver/dashboard' : '/passenger/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <span className="brand">🚗 Dhaka Pool</span>
      </div>

      <div className="card">
        <h2>{mode === 'signup' ? 'Create an account' : 'Sign in'}</h2>

        <div className="tabs">
          <a className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</a>
          <a className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</a>
        </div>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>Full name</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div className="field">
                <label>I am a</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="PASSENGER">Passenger</option>
                  <option value="DRIVER">Driver</option>
                </select>
              </div>
            </>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required />
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn" disabled={loading} type="submit">
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>

      <div className="card">
        <p className="muted"><strong>Demo accounts</strong> (password: <code>password123</code>)</p>
        <p className="muted">Passengers: nusrat@dhakapool.demo · rafiq@dhakapool.demo · shirin@dhakapool.demo</p>
        <p className="muted">Driver: jashim@dhakapool.demo (Tesla Bullet, 3 seats)</p>
      </div>
    </div>
  );
}
