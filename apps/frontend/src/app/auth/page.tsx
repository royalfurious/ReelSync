import Link from 'next/link';

import { AuthPanel } from '@/components/auth-panel';
import { buttonVariants } from '@/components/ui/button';

export default function AuthPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8 md:px-10 lg:px-12">
      <div className="mb-8 flex items-center justify-between">
        <Link className={buttonVariants({ variant: 'ghost' })} href="/">
          Back home
        </Link>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Authentication</p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Create a registered account or sign in.</h1>
          <p className="max-w-2xl text-base leading-7 text-white/65 md:text-lg">
            Guest rooms still work, but signed-in users keep a persistent identity and can be wired into future access control and room ownership flows.
          </p>
        </div>
        <AuthPanel />
      </div>
    </main>
  );
}