"use client";

import { useState } from 'react';

import { Button } from '@/components/ui/button';

type RoomHeaderActionsProps = {
  roomId: string;
};

export function RoomHeaderActions({ roomId }: RoomHeaderActionsProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : `/room/${roomId}`;

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus('copied');
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch {
      setStatus('error');
      window.setTimeout(() => setStatus('idle'), 1800);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button className="min-w-36" size="sm" type="button" onClick={() => void copyInviteLink()}>
        {status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : 'Copy invite link'}
      </Button>
    </div>
  );
}