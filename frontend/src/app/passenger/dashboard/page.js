'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getUser } from '../../../lib/api';
import TopBar from '../../TopBar';
import StatusBadge from '../../StatusBadge';

export default function PassengerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rides, setRides] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'PASSENGER') return router.replace('/login');
    setUser(u);
    load();
  }, [router]);

  async function load() {
    try {
      const data = await api('/api/rides/mine');
      setRides(data);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user) return null;

  const activeRide = rides.find((r) => !['COMPLETED', 'CANCELLED'].includes(r.status));

  return (
    <div>
      <TopBar
        user={user}
        tabs={[
          { href: '/passenger/dashboard', label: 'Dashboard', active: true },
          { href: '/passenger/rides', label: 'Ride history' },
        ]}
      />

      <h1>Hi {user.name} 👋</h1>

      {error && <p className="error">{error}</p>}

      {activeRide ? (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Current ride</h3>
            <StatusBadge status={activeRide.status} />
          </div>
          <p>{activeRide.pickupZone.replace('_', ' ')} → {activeRide.destinationZone.replace('_', ' ')}</p>
          <p className="muted">{activeRide.seatsRequested} seat(s)</p>
          <Link className="btn" href={`/passenger/rides/${activeRide.id}`}>View status</Link>
        </div>
      ) : (
        <div className="card">
          <h3>No active ride</h3>
          <p className="muted">Ready to go somewhere?</p>
          <Link className="btn" href="/passenger/request-ride">Request a ride</Link>
        </div>
      )}
    </div>
  );
}
