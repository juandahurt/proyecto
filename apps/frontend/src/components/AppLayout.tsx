import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { UsageCounter } from './UsageCounter';
import { LimitsProvider } from '../lib/limits-context';
import { RecentProvider } from '../lib/recent-context';
import { cn } from '../lib/utils';

const LINKS = [
  { to: '/upload', label: 'Upload' },
  { to: '/history', label: 'My History' },
  { to: '/trends', label: 'Progress Trends' },
  { to: '/settings', label: 'Settings' },
];

/** Layout con barra lateral para las pantallas con sesión. */
export function AppLayout() {
  const { logout } = useAuth();
  return (
    <LimitsProvider>
      <RecentProvider>
        <div className="flex min-h-screen bg-gray-50">
          <aside className="flex w-64 flex-col justify-between border-r border-gray-200 bg-white p-6">
            <div className="flex flex-col gap-6">
              <Logo />
              <nav aria-label="Main" className="flex flex-col gap-1">
                {LINKS.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100',
                        isActive && 'bg-blue-50 text-blue-700'
                      )
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex flex-col gap-4">
              <UsageCounter />
              <Button variant="outline" onClick={logout}>
                Log out
              </Button>
            </div>
          </aside>
          <main className="flex-1 px-8 py-8">
            <Outlet />
          </main>
        </div>
      </RecentProvider>
    </LimitsProvider>
  );
}
