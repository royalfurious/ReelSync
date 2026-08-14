import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';

import { JoinRoomForm } from '@/components/join-room-form';
import { buttonVariants } from '@/components/ui/button';

type JoinPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { roomId } = await params;

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(139,92,246,0.15),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.15),transparent_50%)]" />
      
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <div className="mb-8">
          <Link className={buttonVariants({ variant: 'ghost' })} href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back home
          </Link>
        </div>

        <div className="flex flex-1 items-center">
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
                <Users className="h-4 w-4" />
                Join room
              </div>
              <h1 className="font-display text-5xl font-bold text-white md:text-6xl lg:text-7xl">
                Enter the
                <br />
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  watch room.
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-white/65 md:text-xl">
                Join your friends and experience synchronized video playback together in real-time.
              </p>
              
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="mb-1 text-sm font-medium text-white/60">Room ID</p>
                <p className="font-mono text-lg text-white">{roomId}</p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-2 w-2 rounded-full bg-green-400" />
                  <p className="text-sm text-white/70">Room is active and ready</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-2 w-2 rounded-full bg-purple-400" />
                  <p className="text-sm text-white/70">Synchronized playback enabled</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-2 w-2 rounded-full bg-pink-400" />
                  <p className="text-sm text-white/70">Real-time chat available</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <JoinRoomForm roomId={roomId} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}