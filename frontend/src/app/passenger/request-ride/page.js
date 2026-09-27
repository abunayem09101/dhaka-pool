'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '../../../lib/api';
import TopBar from '../../TopBar';

// Mirrors backend/src/services/fare.service.js so the passenger sees a
// live estimate before submitting. The backend recomputes authoritatively
// on request (and again for real once pooled) - this is just a preview.
const CLUSTERS = [
  ['BANANI', 'GULSHAN_1', 'MOHAKHALI'],
  ['MIRPUR', 'UTTARA'],
  ['DHANMONDI', 'FARMGATE'],
  ['BASHUNDHARA'],
];
const BASE_FARE = 5000;
const PER_HOP = 1500;

function estimateFare(pickup, destination, seats) {
  if (!pickup || !destination) return null;
  const cluster = CLUSTERS.find((c) => c.includes(pickup)) || [pickup];
  const hops = pickup === destination ? 1 : cluster.includes(destination) ? 1 : 2;
  return (BASE_FARE + hops * PER_HOP) * seats;
}

export default function RequestRidePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [zones, setZones] = useState([]);
  const [pickupZone, setPickupZone] = useState('');
  const [destinationZone, setDestinationZone] = useState('');
  const [seats, setSeats] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'PASSENGER') return router.replace('/login');
    setUser(u);
    api('/api/locations').then(setZones).catch((err) => setError(err.message));
    api('/api/me').then((me) => setWallet(me.walletBalancePaisa)).catch(() => {});
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (pickupZone === destinationZone) {
      setError('Pickup and destination must be different.');
      return;
    }
    setLoading(true);
    try {
      const ride = await api('/api/rides', {
        method: 'POST',
        body: { pickupZone, destinationZone, seatsRequested: Number(seats), paymentMethod },
      });
      router.push(`/passenger/rides/${ride.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;
  const estimate = estimateFare(pickupZone, destinationZone, Number(seats));

  return (
    <div>
      <TopBar user={user} tabs={[{ href: '/passenger/dashboard', label: 'Dashboard' }, { href: '/passenger/rides', label: 'Ride history' }]} />
      <h1>Request a ride</h1>

      <form className="card" onSubmit={submit}>
        <div className="field">
          <label>Pickup</label>
          <select value={pickupZone} onChange={(e) => setPickupZone(e.target.value)} required>
            <option value="">Select pickup zone</option>
            {zones.map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Destination</label>
          <select value={destinationZone} onChange={(e) => setDestinationZone(e.target.value)} required>
            <option value="">Select destination zone</option>
            {zones.map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Seats needed</label>
          <select value={seats} onChange={(e) => setSeats(e.target.value)}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        <div className="field">
          <label>Payment method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="CASH">Cash (pay driver directly)</option>
            <option value="TESLAPAY">TeslaPay wallet{wallet !== null ? ` — balance ৳${(wallet / 100).toFixed(2)}` : ''}</option>
          </select>
        </div>

        {estimate !== null && (
          <p className="muted">Estimated fare (before pooling discount): ৳{(estimate / 100).toFixed(2)}</p>
        )}

        {error && <p className="error">{error}</p>}

        <button className="btn" disabled={loading} type="submit">
          {loading ? 'Requesting…' : 'Request ride'}
        </button>
      </form>
    </div>
  );
}
