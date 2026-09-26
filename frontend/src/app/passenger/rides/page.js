'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getUser } from '../../../lib/api';
import TopBar from '../../TopBar';
import StatusBadge from '../../StatusBadge';

export default function PassengerRidesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'PASSENGER') return router.replace('/login');
    setUser(u);
    api('/api/rides/mine').then(setRides).catch((err) => setError(err.message));
  }, [router]);

  if (!user) return null;

  return (
    <div>
      <TopBar user={user} tabs={[{ href: '/passenger/dashboard', label: 'Dashboard' }, { href: '/passenger/rides', label: 'Ride history', active: true }]} />
      <h1>Your ride history</h1>
      {error && <p className="error">{error}</p>}
      {rides.length === 0 && <p className="muted">No rides yet.</p>}
      {rides.map((r) => (
        <Link key={r.id} href={`/passenger/rides/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{r.pickupZone.replace('_', ' ')} → {r.destinationZone.replace('_', ' ')}</strong>
              <StatusBadge status={r.status} />
            </div>
            <p className="muted">{r.seatsRequested} seat(s) · ৳{(r.estimatedFarePaisa / 100).toFixed(2)} · {new Date(r.createdAt).toLocaleString()}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
