"use client";

import Link from 'next/link';
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PlayCircle,
  Settings,
  Signal,
  Users
} from 'lucide-react';

import { cn } from '@/lib/utils';

type RoomSidebarProps = {
  roomCode: string;
  isHost: boolean;
  onEndRoom?: () => void;
  onLeaveRoom?: () => void;
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'room-settings', label: 'Room Settings', icon: Settings },
  { id: 'playback', label: 'Playback', icon: PlayCircle }
] as const;

const comingSoonItems = [
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Stream Quality', icon: Signal },
  { label: 'Activity Log', icon: Activity }
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function RoomSidebar({ roomCode, isHost, onEndRoom, onLeaveRoom }: RoomSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-white/[0.03] px-4 py-6 lg:flex">
      <div className="space-y-8">
        <Link className="flex items-center gap-2 px-2" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primaryForeground">
            <PlayCircle className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold text-white">
            ReelSync
            <span className="block text-[0.65rem] font-normal uppercase tracking-[0.25em] text-white/45">
              {isHost ? 'Host Dashboard' : 'Participant View'}
            </span>
          </span>
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white',
                item.id === 'dashboard' && 'bg-white/[0.08] text-white'
              )}
              type="button"
              onClick={() => scrollToSection(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}

          <div className="pt-2">
            {comingSoonItems.map((item) => (
              <div
                key={item.label}
                className="flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/30"
              >
                <span className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide">Soon</span>
              </div>
            ))}
          </div>
        </nav>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Room</p>
          <p className="mt-1 font-mono text-sm text-white">{roomCode}</p>
        </div>

        {isHost ? (
          <div className="space-y-2">
            <p className="px-2 text-xs uppercase tracking-[0.2em] text-white/45">Host Controls</p>
            <button
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
              type="button"
              onClick={() => scrollToSection('participants')}
            >
              <Users className="h-4 w-4" />
              Transfer Host
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
              type="button"
              onClick={() => scrollToSection('room-settings')}
            >
              <Settings className="h-4 w-4" />
              Room Settings
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-2xl bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
              type="button"
              onClick={onEndRoom}
            >
              <LogOut className="h-4 w-4" />
              End Room
            </button>
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-3 rounded-2xl bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
            type="button"
            onClick={onLeaveRoom}
          >
            <LogOut className="h-4 w-4" />
            Leave Room
          </button>
        )}
      </div>
    </aside>
  );
}
