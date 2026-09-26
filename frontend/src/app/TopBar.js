'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearSession } from '../lib/api';

export default function TopBar({ user, tabs = [] }) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <>
      <div className="topbar">
        <Link className="brand" href="/">🚗 Dhaka Pool</Link>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="muted">{user?.name} ({user?.role})</span>
          <button className="btn secondary" onClick={logout}>Log out</button>
        </div>
      </div>
      {tabs.length > 0 && (
        <div className="tabs">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={t.active ? 'active' : ''}>
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
