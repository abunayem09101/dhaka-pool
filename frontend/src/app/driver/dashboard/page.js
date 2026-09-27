'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getUser } from '../../../lib/api';
import TopBar from '../../TopBar';
import StatusBadge from '../../StatusBadge';

const NEXT_ACTION = {
  OPEN: { label: 'Mark driver arrived', endpoint: 'arrived' },
  FULL: { label: 'Mark driver arrived', endpoint: 'arrived' },
  DRIVER_ARRIVED: { label: 'Start trip', endpoint: 'start' },
  IN_PROGRESS: { label: 'Complete trip', endpoint: 'complete' },
};

export default function DriverDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [pool, setPool] = useState(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'DRIVER') return router.replace('/login');
    setUser(u);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    try {
      const p = await api('/api/driver/pools/current');
      setPool(p);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleOnline() {
    setBusy(true);
    try {
      const vehicle = await api('/api/driver/online', { method: 'POST', body: { online: !online } });
      setOnline(vehicle.isOnline);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    if (!pool) return;
    const action = NEXT_ACTION[pool.status];
    if (!action) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/api/driver/pools/${pool.id}/${action.endpoint}`, { method: 'POST' });
      setPool(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <TopBar
        user={user}
        tabs={[
          { href: '/driver/dashboard', label: 'Dashboard', active: true },
          { href: '/driver/requests', label: 'Ride requests' },
          { href: '/driver/rides', label: 'History' },
        ]}
      />

      <h1>Hi {user.name} 👋</h1>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>You are {online ? 'Online' : 'Offline'}</strong>
            <p className="muted">Tesla Bullet · 3 seats</p>
          </div>
          <button className="btn" disabled={busy} onClick={toggleOnline}>
            {online ? 'Go offline' : 'Go online'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {pool ? (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Current pool ({pool.occupiedSeats}/3 seats)</h3>
            <StatusBadge status={pool.status} />
          </div>
          <p className="muted">{pool.pickupZone.replace('_', ' ')} → {pool.destinationZone.replace('_', ' ')}</p>

          {pool.members.map((m) => (
            <p key={m.id}>
              👤 {m.rideRequest.passenger.name} — {m.seats} seat(s), ৳{(m.farePaisa / 100).toFixed(2)}
              {' '}({m.rideRequest.paymentMethod === 'TESLAPAY' ? 'TeslaPay' : 'Cash'}
              {m.rideRequest.paymentStatus !== 'PENDING' ? `, ${m.rideRequest.paymentStatus}` : ''})
            </p>
          ))}

          {NEXT_ACTION[pool.status] && (
            <button className="btn" disabled={busy} onClick={advance}>
              {busy ? 'Working…' : NEXT_ACTION[pool.status].label}
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="muted">No active pool right now.</p>
          <Link className="btn" href="/driver/requests">Browse ride requests</Link>
        </div>
      )}
    </div>
  );
}
