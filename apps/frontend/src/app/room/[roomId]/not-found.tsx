import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';

export default function RoomNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12 md:px-10 lg:px-12">
      <section className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur-xl md:p-10">
        <p className="text-sm uppercase tracking-[0.3em] text-white/45">Room unavailable</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-white">This room link is no longer valid.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
          The room may have ended, the link may be incorrect, or the host may have removed access.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className={buttonVariants({ size: 'lg' })} href="/create">
            Create a room
          </Link>
          <Link className={buttonVariants({ variant: 'secondary', size: 'lg' })} href="/">
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}