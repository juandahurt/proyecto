import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui/button';
import { Logo } from './Logo';
import { cn } from '../lib/utils';

const LINKS = [
  { to: '/upload', label: 'Upload' },
  { to: '/history', label: 'My History' },
  { to: '/settings', label: 'Settings' },
];

/** Layout con barra lateral para las pantallas con sesión. */
export function AppLayout() {
  const { logout } = useAuth();
  return (
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
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </aside>
      <main className="flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
