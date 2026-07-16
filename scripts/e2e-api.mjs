const API = process.env.BACKEND_URL || 'http://localhost:3000';

const assert = (cond, msg) => {
  if (!cond) {
    throw new Error(msg);
  }
};

async function req(path, { method = 'GET', body, expected } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_error) {
    data = null;
  }

  if (expected !== undefined && res.status !== expected) {
    throw new Error(
      `${method} ${path} -> expected ${expected}, got ${res.status} body=${JSON.stringify(data)}`
    );
  }

  return { status: res.status, data };
}

async function run() {
  console.log('1) create session');
  const created = await req('/api/sessions', {
    method: 'POST',
    body: { nickname: 'Magali' },
    expected: 201
  });

  const host = created.data;
  assert(/^[A-HJ-NP-Z2-9]{6}$/.test(host.sessionCode), 'invalid session code format');
  assert(host.role === 'HOST', 'host role mismatch');

  console.log('2) get public session');
  const pub = await req(`/api/sessions/${host.sessionCode.toLowerCase()}`, { expected: 200 });
  assert(pub.data.sessionCode === host.sessionCode, 'public session code mismatch');
  assert(!('playerToken' in pub.data), 'public endpoint leaks token');

  console.log('3) join player');
  const joined = await req(`/api/sessions/${host.sessionCode}/join`, {
    method: 'POST',
    body: { nickname: 'Alice' },
    expected: 201
  });
  assert(joined.data.role === 'PLAYER', 'joined role mismatch');

  console.log('4) duplicate nickname blocked');
  await req(`/api/sessions/${host.sessionCode}/join`, {
    method: 'POST',
    body: { nickname: 'Alice' },
    expected: 409
  });

  console.log('5) reconnect valid');
  await req(`/api/sessions/${host.sessionCode}/reconnect`, {
    method: 'POST',
    body: { playerId: joined.data.playerId, playerToken: joined.data.playerToken },
    expected: 200
  });

  console.log('6) reconnect invalid token rejected');
  await req(`/api/sessions/${host.sessionCode}/reconnect`, {
    method: 'POST',
    body: { playerId: joined.data.playerId, playerToken: 'bad-token' },
    expected: 401
  });

  console.log('7) non-host start rejected');
  await req(`/api/sessions/${host.sessionCode}/start`, {
    method: 'POST',
    body: { playerId: joined.data.playerId, playerToken: joined.data.playerToken },
    expected: 403
  });

  console.log('8) host start accepted');
  const started = await req(`/api/sessions/${host.sessionCode}/start`, {
    method: 'POST',
    body: { playerId: host.playerId, playerToken: host.playerToken },
    expected: 200
  });
  assert(started.data.status === 'PLAYING', 'status should be PLAYING');

  console.log('9) join blocked after start');
  await req(`/api/sessions/${host.sessionCode}/join`, {
    method: 'POST',
    body: { nickname: 'Bob' },
    expected: 409
  });

  console.log('10) leave invalid token rejected');
  await req(`/api/sessions/${host.sessionCode}/leave`, {
    method: 'POST',
    body: { playerId: joined.data.playerId, playerToken: 'invalid' },
    expected: 401
  });

  console.log('11) leave valid');
  await req(`/api/sessions/${host.sessionCode}/leave`, {
    method: 'POST',
    body: { playerId: joined.data.playerId, playerToken: joined.data.playerToken },
    expected: 200
  });

  console.log('12) max players enforcement on fresh session');
  const maxCase = await req('/api/sessions', {
    method: 'POST',
    body: { nickname: 'Host2' },
    expected: 201
  });

  for (let i = 0; i < 9; i += 1) {
    await req(`/api/sessions/${maxCase.data.sessionCode}/join`, {
      method: 'POST',
      body: { nickname: `P${i}` },
      expected: 201
    });
  }

  await req(`/api/sessions/${maxCase.data.sessionCode}/join`, {
    method: 'POST',
    body: { nickname: 'Overflow' },
    expected: 409
  });

  console.log('\nE2E API checks: OK');
}

run().catch((error) => {
  console.error('\nE2E API checks FAILED');
  console.error(error.message);
  process.exit(1);
});
