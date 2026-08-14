import { notFound } from 'next/navigation';

import { RoomShell } from '@/components/room-shell';

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ memberId?: string }>;
};

// Server Components fetch on Node, so a relative URL has no origin to resolve against.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function validateRoom(roomId: string) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
      cache: 'no-store'
    });
  } catch {
    throw new Error('Unable to reach the watch-party API. Make sure the backend server is running.');
  }

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error('Unable to load room details.');
  }
}

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  await validateRoom(roomId);

  return <RoomShell roomId={roomId} {...(query.memberId ? { memberId: query.memberId } : {})} />;
}