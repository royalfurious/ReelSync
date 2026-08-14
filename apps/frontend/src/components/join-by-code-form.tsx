"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractRoomIdentifier(input: string): string {
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const roomIndex = segments.findIndex((segment) => segment === 'room' || segment === 'join');
    if (roomIndex >= 0 && segments[roomIndex + 1]) {
      return segments[roomIndex + 1] as string;
    }
  } catch {
    // not a URL, fall through to treating the input as a raw code/id
  }

  return trimmed;
}

export function JoinByCodeForm() {
  const router = useRouter();
  const [roomInput, setRoomInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const identifier = extractRoomIdentifier(roomInput);
    if (!identifier) {
      setError('Enter a room code or invite link.');
      return;
    }

    startTransition(async () => {
      try {
        const roomId = UUID_PATTERN.test(identifier) ? identifier : await resolveRoomCode(identifier);
        router.push(`/join/${roomId}`);
      } catch (error_: unknown) {
        setError(error_ instanceof Error ? error_.message : 'Unable to find that room.');
      }
    });
  };

  const resolveRoomCode = async (roomCode: string): Promise<string> => {
    const response = await fetch(`/api/rooms/code/${encodeURIComponent(roomCode)}`);

    if (response.status === 404) {
      throw new Error('No room found with that code.');
    }

    if (!response.ok) {
      throw new Error('Unable to find that room right now.');
    }

    const room = (await response.json()) as { roomId: string };
    return room.roomId;
  };

  return (
    <Card className="w-full border-white/10 bg-white/5 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Join a room</CardTitle>
        <CardDescription className="text-base">Enter a room code or paste an invite link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="roomInput">
              Room code or invite link
            </label>
            <Input
              id="roomInput"
              required
              placeholder="e.g. UBDSHZ38"
              value={roomInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setRoomInput(event.target.value)}
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
              'Finding room…'
            ) : (
              <>
                <Users className="mr-2 h-5 w-5" />
                Continue
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
