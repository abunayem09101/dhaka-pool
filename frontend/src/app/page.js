'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '../lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) return router.replace('/login');
    if (user.role === 'DRIVER') return router.replace('/driver/dashboard');
    return router.replace('/passenger/dashboard');
  }, [router]);

  return <p className="muted">Loading Dhaka Pool…</p>;
}
