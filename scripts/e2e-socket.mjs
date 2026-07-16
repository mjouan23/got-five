import { io } from 'socket.io-client';

const API = process.env.BACKEND_URL || 'http://localhost:3000';

const EVENTS = {
  SESSION_JOIN: 'session:join',
  SESSION_LEAVE: 'session:leave',
  SESSION_STATE: 'session:state',
  SESSION_ERROR: 'session:error',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_DISCONNECTED: 'player:disconnected',
  GAME_START: 'game:start',
  GAME_STARTED: 'game:started'
};

const assert = (cond, msg) => {
  if (!cond) {
    throw new Error(msg);
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForEvent(socket, eventName, timeoutMs = 5000, predicate = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeoutMs);

    const handler = (payload) => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    };

    socket.on(eventName, handler);
  });
}

async function api(path, { method = 'GET', body, expected = 200 } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);
  if (res.status !== expected) {
    throw new Error(`${method} ${path} expected ${expected}, got ${res.status} body=${JSON.stringify(data)}`);
  }

  return data;
}

function connectClient(label) {
  const socket = io(API, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: false
  });

  socket.on(EVENTS.SESSION_ERROR, (payload) => {
    console.error(`[${label}] session:error`, payload);
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} connect timeout`)), 5000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function run() {
  console.log('1) Setup session and players via API');
  const host = await api('/api/sessions', {
    method: 'POST',
    expected: 201,
    body: { nickname: 'HostSocket' }
  });
  const player = await api(`/api/sessions/${host.sessionCode}/join`, {
    method: 'POST',
    expected: 201,
    body: { nickname: 'PlayerSocket' }
  });

  console.log('2) Connect host and join room');
  const hostSocket = await connectClient('host');
  const hostStateP = waitForEvent(
    hostSocket,
    EVENTS.SESSION_STATE,
    6000,
    (state) => state?.sessionCode === host.sessionCode
  );
  hostSocket.emit(EVENTS.SESSION_JOIN, {
    sessionCode: host.sessionCode,
    playerId: host.playerId,
    playerToken: host.playerToken
  });
  const hostState = await hostStateP;
  assert(Array.isArray(hostState.players), 'host state players missing');

  console.log('3) Connect player and verify host receives player:joined');
  const playerSocket = await connectClient('player');
  const hostJoinedP = waitForEvent(
    hostSocket,
    EVENTS.PLAYER_JOINED,
    6000,
    (payload) => payload?.playerId === player.playerId
  );
  const playerStateP = waitForEvent(
    playerSocket,
    EVENTS.SESSION_STATE,
    6000,
    (state) => state?.sessionCode === host.sessionCode
  );

  playerSocket.emit(EVENTS.SESSION_JOIN, {
    sessionCode: host.sessionCode,
    playerId: player.playerId,
    playerToken: player.playerToken
  });

  await hostJoinedP;
  const playerState = await playerStateP;
  assert(playerState.players.length >= 2, 'player state should include 2 players');

  console.log('4) Host starts game via socket and player receives game:started');
  const gameStartedP = waitForEvent(
    playerSocket,
    EVENTS.GAME_STARTED,
    6000,
    (payload) => payload?.status === 'PLAYING'
  );
  hostSocket.emit(EVENTS.GAME_START, {
    sessionCode: host.sessionCode,
    playerId: host.playerId,
    playerToken: host.playerToken
  });

  const gameStarted = await gameStartedP;
  assert(gameStarted.status === 'PLAYING', 'game status not PLAYING');

  console.log('5) Disconnect player and verify host receives player:disconnected');
  const disconnectedP = waitForEvent(
    hostSocket,
    EVENTS.PLAYER_DISCONNECTED,
    6000,
    (payload) => payload?.playerId === player.playerId
  );
  playerSocket.disconnect();
  await disconnectedP;

  console.log('6) Reconnect player and rejoin with same token');
  const playerSocket2 = await connectClient('player-reconnect');
  const reconnectStateP = waitForEvent(
    playerSocket2,
    EVENTS.SESSION_STATE,
    6000,
    (state) => state?.sessionCode === host.sessionCode
  );
  playerSocket2.emit(EVENTS.SESSION_JOIN, {
    sessionCode: host.sessionCode,
    playerId: player.playerId,
    playerToken: player.playerToken
  });

  const reconnectState = await reconnectStateP;
  const self = reconnectState.players.find((entry) => entry.id === player.playerId);
  assert(self, 'reconnected player missing from state');

  console.log('7) Player leaves via socket and host receives player:left');
  const leftP = waitForEvent(
    hostSocket,
    EVENTS.PLAYER_LEFT,
    6000,
    (payload) => payload?.playerId === player.playerId
  );
  playerSocket2.emit(EVENTS.SESSION_LEAVE, {
    sessionCode: host.sessionCode,
    playerId: player.playerId,
    playerToken: player.playerToken
  });
  await leftP;

  await wait(300);
  const finalPublic = await api(`/api/sessions/${host.sessionCode}`, { expected: 200 });
  assert(finalPublic.playersCount === 1, `expected 1 player remaining, got ${finalPublic.playersCount}`);

  hostSocket.disconnect();
  playerSocket2.disconnect();

  console.log('\nSocket.IO E2E checks: OK');
}

run().catch((error) => {
  console.error('\nSocket.IO E2E checks FAILED');
  console.error(error.message);
  process.exit(1);
});
