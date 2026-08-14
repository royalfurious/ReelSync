"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type CreateRoomResponse = {
  roomId: string;
  roomCode: string;
  shareUrl: string;
  hostToken: string;
  hostMemberId: string;
};

export function CreateRoomForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const payload = (await response.json()) as { user: { name: string } | null };
        if (payload.user && !displayName) {
          setDisplayName(payload.user.name);
        }
      } catch {
        // ignore auth preload errors
      }
    };

    void loadCurrentUser();
  }, [displayName]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostDisplayName: displayName })
        });

        if (!response.ok) {
          throw new Error('Unable to create a room right now.');
        }

        const room = (await response.json()) as CreateRoomResponse;
        router.push(`/room/${room.roomId}?memberId=${room.hostMemberId}`);
      } catch (error_: unknown) {
        setError(error_ instanceof Error ? error_.message : 'Unable to create a room right now.');
      }
    });
  };

  return (
    <Card className="w-full border-white/10 bg-white/5 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create your room</CardTitle>
        <CardDescription className="text-base">Enter your name to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="displayName">
              Display name
            </label>
            <Input
              id="displayName"
              minLength={2}
              maxLength={40}
              required
              placeholder="Enter your name"
              value={displayName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)}
              className="h-12 border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <Button 
            className="h-12 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-base hover:from-purple-600 hover:to-pink-600" 
            disabled={isPending} 
            type="submit"
          >
            {isPending ? (
              'Creating room…'
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Create room
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}