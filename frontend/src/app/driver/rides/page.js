'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '../../../lib/api';
import TopBar from '../../TopBar';
import StatusBadge from '../../StatusBadge';

export default function DriverHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [pools, setPools] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'DRIVER') return router.replace('/login');
    setUser(u);
    api('/api/driver/history').then(setPools).catch((err) => setError(err.message));
  }, [router]);

  if (!user) return null;

  return (
    <div>
      <TopBar
        user={user}
        tabs={[
          { href: '/driver/dashboard', label: 'Dashboard' },
          { href: '/driver/requests', label: 'Ride requests' },
          { href: '/driver/rides', label: 'History', active: true },
        ]}
      />
      <h1>Past trips</h1>
      {error && <p className="error">{error}</p>}
      {pools.length === 0 && <p className="muted">No completed or cancelled trips yet.</p>}
      {pools.map((p) => (
        <div key={p.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{p.pickupZone.replace('_', ' ')} → {p.destinationZone.replace('_', ' ')}</strong>
            <StatusBadge status={p.status} />
          </div>
          {p.members.map((m) => (
            <p key={m.id} className="muted">👤 {m.rideRequest.passenger.name} — {m.seats} seat(s), ৳{(m.farePaisa / 100).toFixed(2)}</p>
          ))}
        </div>
      ))}
    </div>
  );
}
