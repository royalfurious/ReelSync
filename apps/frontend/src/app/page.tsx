import Link from 'next/link';
import { Video, Users, Shield, Zap, Play, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MainNav } from '@/components/main-nav';

const features = [
  {
    icon: Video,
    title: 'Synchronized Playback',
    description: 'Play, pause, seek together. Always in sync.'
  },
  {
    icon: MessageSquare,
    title: 'Real-time Chat',
    description: 'Talk, react and share the moment.'
  },
  {
    icon: Zap,
    title: 'High Quality Streaming',
    description: 'Crystal clear video with minimal buffering.'
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Your rooms are private and fully secure.'
  },
  {
    icon: Users,
    title: 'Any Device',
    description: 'Works on desktop, tablet and mobile.'
  },
  {
    icon: Play,
    title: 'Local Video Support',
    description: 'No uploads. Stream directly from your files.'
  }
];

const stats = [
  { value: '12K+', label: 'Happy Users' },
  { value: '5K+', label: 'Rooms Created' },
  { value: '250K+', label: 'Hours Watched' },
  { value: '100+', label: 'Countries' }
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <MainNav />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.15),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-6 md:px-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-sm text-purple-300 backdrop-blur">
              <Zap className="h-4 w-4" />
              Watch Together. Anytime. Anywhere.
            </div>
            <h1 className="font-display mb-6 text-5xl font-bold tracking-tight text-white md:text-7xl lg:text-8xl">
              Watch movies
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                together.
              </span>
              <br />
              Like never before.
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/65 md:text-xl">
              Create a room, invite your friends and enjoy synchronized playback, real-time chat and unforgettable movie nights.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/create">
                <Button size="lg" className="h-12 bg-gradient-to-r from-purple-500 to-pink-500 px-8 text-base hover:from-purple-600 hover:to-pink-600">
                  <Play className="mr-2 h-5 w-5" />
                  Create a Room
                </Button>
              </Link>
              <Link href="/join">
                <Button variant="secondary" size="lg" className="h-12 border-white/20 px-8 text-base hover:bg-white/10">
                  <Users className="mr-2 h-5 w-5" />
                  Join a Room
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="mb-1 text-3xl font-bold text-white md:text-4xl">{stat.value}</div>
                  <div className="text-sm text-white/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">Why ReelSync?</h2>
            <p className="mx-auto max-w-2xl text-lg text-white/65">
              Everything you need for the perfect watch party.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-white/10 bg-white/5 backdrop-blur transition hover:border-purple-500/30 hover:bg-white/10">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">How It Works</h2>
            <p className="mx-auto max-w-2xl text-lg text-white/65">
              Get started in three simple steps.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: '01', title: 'Create a Room', description: 'Start a new watch party room with a single click.' },
              { step: '02', title: 'Invite Friends', description: 'Share the room link or code with your friends.' },
              { step: '03', title: 'Watch Together', description: 'Select your video and enjoy synchronized playback.' }
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="mb-4 text-6xl font-bold text-white/10">{item.step}</div>
                <h3 className="mb-2 text-2xl font-semibold text-white">{item.title}</h3>
                <p className="text-white/65">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <Card className="relative overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.3),transparent_50%)]" />
            <CardContent className="relative px-6 py-16 text-center md:px-12">
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">
                Ready to watch together?
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70">
                Create your first room now and experience synchronized playback like never before.
              </p>
              <Link href="/create">
                <Button size="lg" className="h-12 bg-gradient-to-r from-purple-500 to-pink-500 px-8 text-base hover:from-purple-600 hover:to-pink-600">
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-white/50 md:px-10">
          <p>&copy; 2026 ReelSync. Built with Next.js, LiveKit & Socket.IO.</p>
        </div>
      </footer>
    </main>
  );
}