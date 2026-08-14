import { env } from './config/env.js';
import { createRealtimeServer } from './realtime/socket.js';
import { buildServer } from './server.js';
import { hydrateRooms } from './services/rooms.js';
import { loadPersistedRooms } from './services/room-persistence.js';

async function main() {
  const app = buildServer();
  hydrateRooms(await loadPersistedRooms());

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  const realtime = createRealtimeServer(app.server);

  return realtime;
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});