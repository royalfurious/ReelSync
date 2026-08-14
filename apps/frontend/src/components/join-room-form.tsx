"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type JoinRoomResponse = {
  roomId: string;
  roomCode: string;
  memberId: string;
  displayName: string;
};

type JoinRoomFormProps = {
  roomId: string;
};

export function JoinRoomForm({ roomId }: JoinRoomFormProps) {
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
        const response = await fetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName })
        });

        if (response.status === 404) {
          throw new Error('This room does not exist or has already ended.');
        }

        if (!response.ok) {
          throw new Error('Unable to join this room right now.');
        }

        const member = (await response.json()) as JoinRoomResponse;
        router.push(`/room/${member.roomId}?memberId=${member.memberId}`);
      } catch (error_: unknown) {
        setError(error_ instanceof Error ? error_.message : 'Unable to join this room right now.');
      }
    });
  };

  return (
    <Card className="w-full border-white/10 bg-white/5 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Join room</CardTitle>
        <CardDescription className="text-base">Enter a display name to join the session as a guest or participant.</CardDescription>
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
          {error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <Button 
            className="h-12 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-base hover:from-purple-600 hover:to-pink-600" 
            disabled={isPending} 
            type="submit"
          >
            {isPending ? (
              'Joining…'
            ) : (
              <>
                <Users className="mr-2 h-5 w-5" />
                Join room
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}