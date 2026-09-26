'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '../../../lib/api';
import TopBar from '../../TopBar';

export default function DriverRequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'DRIVER') return router.replace('/login');
    setUser(u);
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function load() {
    try {
      const data = await api('/api/driver/requests');
      setRequests(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function accept(id) {
    setBusyId(id);
    setError('');
    try {
      await api(`/api/driver/requests/${id}/accept`, { method: 'POST' });
      router.push('/driver/dashboard');
    } catch (err) {
      setError(err.message);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!user) return null;

  return (
    <div>
      <TopBar
        user={user}
        tabs={[
          { href: '/driver/dashboard', label: 'Dashboard' },
          { href: '/driver/requests', label: 'Ride requests', active: true },
          { href: '/driver/rides', label: 'History' },
        ]}
      />
      <h1>Available ride requests</h1>
      <p className="muted">Showing requests compatible with your vehicle&apos;s current pool and open seats. Go online from the dashboard to see any.</p>

      {error && <p className="error">{error}</p>}
      {requests.length === 0 && <p className="muted">No compatible requests right now.</p>}

      {requests.map((r) => (
        <div key={r.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{r.passenger.name}</strong>
            <span className="muted">{r.seatsRequested} seat(s)</span>
          </div>
          <p>{r.pickupZone.replace('_', ' ')} → {r.destinationZone.replace('_', ' ')}</p>
          <button className="btn" disabled={busyId === r.id} onClick={() => accept(r.id)}>
            {busyId === r.id ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      ))}
    </div>
  );
}
