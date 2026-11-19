import type { ReactNode } from 'react';
import { Logo } from './Logo';

/** Marco de pantallas sin sesión y del onboarding: logo arriba y contenido centrado. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <Logo />
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-8 py-12">{children}</main>
    </div>
  );
}
