'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, getUser } from '../../../../lib/api';
import TopBar from '../../../TopBar';
import StatusBadge from '../../../StatusBadge';

const CANCELLABLE = ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED'];

export default function PassengerRideDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ride, setRide] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'PASSENGER') return router.replace('/login');
    setUser(u);
    load();
    const interval = setInterval(load, 4000); // simple polling for live status
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    try {
      const data = await api(`/api/rides/${id}`);
      setRide(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/rides/${id}/cancel`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user || !ride) return null;

  const driver = ride.poolMember?.pool?.vehicle?.driver;

  return (
    <div>
      <TopBar user={user} tabs={[{ href: '/passenger/dashboard', label: 'Dashboard' }, { href: '/passenger/rides', label: 'Ride history' }]} />

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{ride.pickupZone.replace('_', ' ')} → {ride.destinationZone.replace('_', ' ')}</h2>
          <StatusBadge status={ride.status} />
        </div>
        <p className="muted">{ride.seatsRequested} seat(s) · Fare: ৳{(ride.estimatedFarePaisa / 100).toFixed(2)}</p>

        {driver && (
          <p>Driver: <strong>{driver.name}</strong> — {ride.poolMember.pool.vehicle.model} {ride.poolMember.pool.vehicle.name}</p>
        )}

        {error && <p className="error">{error}</p>}

        {CANCELLABLE.includes(ride.status) && (
          <button className="btn danger" disabled={busy} onClick={cancel}>
            {busy ? 'Cancelling…' : 'Cancel ride'}
          </button>
        )}
      </div>

      <div className="card">
        <h3>Status history</h3>
        {ride.statusHistory.map((h) => (
          <p key={h.id} className="muted">
            {new Date(h.changedAt).toLocaleTimeString()} — {h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}
            {h.note ? ` (${h.note})` : ''}
          </p>
        ))}
      </div>
    </div>
  );
}
