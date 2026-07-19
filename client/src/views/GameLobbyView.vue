<template>
  <section v-if="showRotatePrompt" class="card rotate-prompt stack">
    <div class="rotate-icon" aria-hidden="true">
      <span class="phone-shape" />
      <span class="rotate-arrow" />
    </div>
    <h3>Passez en mode paysage</h3>
    <p>Tournez votre téléphone pour continuer la partie.</p>
  </section>

  <section v-else class="stack">
    <article v-if="!isPlaying" class="card stack">
      <div class="lobby-top">
        <img class="session-logo" src="/logo.png" alt="Logo Got Five" />
        <div>
          <h2>Session {{ currentCode }}</h2>
          <ConnectionStatus :status="socketState" />
        </div>
      </div>

      <div class="stack">
        <QrCodeBlock :value="joinUrl" />

        <div class="stack actions-inline">
          <button class="btn secondary" type="button" @click="copyCode">Copier le code</button>
          <button class="btn secondary" type="button" @click="copyLink">Copier le lien</button>
        </div>
      </div>

      <p v-if="copyMessage" class="success-text">{{ copyMessage }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </article>

    <article v-if="!isPlaying" class="card stack">
      <h3>Joueurs connectés</h3>
      <ul class="players">
        <li v-for="player in store.players" :key="player.id" class="player-row">
          <span>{{ player.nickname }} <small>({{ roleLabel(player.role) }})</small></span>
          <span :class="player.connected ? 'online' : 'offline'">
            {{ player.connected ? 'En ligne' : 'Hors ligne' }}
          </span>
        </li>
      </ul>

      <p v-if="store.isHost && canStartGame" class="start-suggestion">
        2 joueurs connectés: vous pouvez lancer la partie.
      </p>

      <button v-if="store.isHost" class="btn" type="button" :disabled="!canStartGame" @click="startGame">
        Commencer la partie
      </button>
      <p v-if="store.isHost && !canStartGame" class="start-hint">
        En attente d'au moins 2 joueurs connectés.
      </p>
      <button class="btn secondary" type="button" @click="leaveSession">Quitter la partie</button>
    </article>

    <article v-if="isPlaying" class="card stack playing-layout">
      <ul class="tiles-grid">
        <li v-for="tile in displayTiles" :key="tile.id" class="tile-card" :class="colorClass(tile.couleur)">
          <div class="tile-eyes" :class="eyeClass(tile.couleur)">
            <span class="eye eye-left" />
            <span class="eye eye-right" />
          </div>
        </li>
      </ul>

      <section class="reference-board stack" aria-label="Tableau des 60 tuiles">
        <ul class="reference-row" v-for="row in referenceRows" :key="row.color">
          <li
            v-for="tile in row.tiles"
            :key="tile.chiffre"
            class="reference-tile"
            :class="colorClass(tile.couleur)"
          >
            <strong>{{ tile.chiffre }}</strong>
            <small>{{ pointsLabel(tile.nombrePoints) }}</small>
          </li>
        </ul>
      </section>

      <p v-if="!playerTiles.length" class="start-hint">Attribution des nombres en cours...</p>
      <button class="btn secondary" type="button" @click="leaveSession">Quitter la partie</button>
    </article>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConnectionStatus from '../components/ConnectionStatus.vue';
import QrCodeBlock from '../components/QrCodeBlock.vue';
import { extractSessionCode, normalizeSessionCode } from '../composables/useSessionCode';
import { socketService } from '../services/socketService';
import { sessionApi } from '../services/api';
import { useSessionStore } from '../stores/sessionStore';
import tilesData from '../data/tiles.json';

const route = useRoute();
const router = useRouter();
const store = useSessionStore();

const socketState = ref('disconnected');
const copyMessage = ref('');
const error = ref('');
const isPhonePortrait = ref(false);

const currentCode = computed(() => normalizeSessionCode(route.params.sessionCode));
const appHost = window.location.hostname;
const useRuntimeOrigin = appHost === 'localhost' || appHost === '127.0.0.1';
const publicUrl = useRuntimeOrigin
  ? window.location.origin
  : import.meta.env.VITE_PUBLIC_URL || window.location.origin;
const joinUrl = computed(() => `${publicUrl.replace(/\/$/, '')}/join/${currentCode.value}`);
const connectedPlayersCount = computed(() =>
  store.players.filter((player) => player.connected).length
);
const canStartGame = computed(() => connectedPlayersCount.value >= 2);
const isPlaying = computed(() => store.gameStatus === 'PLAYING');
const playerTiles = computed(() => store.currentPlayerTiles);
const colorOrder = ['vert', 'rose', 'bleu', 'rouge', 'orange'];
const displayTiles = computed(() => {
  if (playerTiles.value.length) {
    return playerTiles.value;
  }
  return colorOrder.map((color, index) => ({
    id: `placeholder-${color}-${index + 1}`,
    couleur: color
  }));
});
const referenceRows = computed(() =>
  colorOrder.map((color) => ({
    color,
    tiles: [...tilesData]
      .filter((tile) => tile.couleur === color)
      .sort((first, second) => first.chiffre - second.chiffre)
  }))
);
const showRotatePrompt = computed(() => isPlaying.value && isPhonePortrait.value);

const updateOrientationState = () => {
  const isPhoneWidth = window.matchMedia('(max-width: 900px)').matches;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  isPhonePortrait.value = isPhoneWidth && isPortrait;
};

const colorClass = (color) => {
  if (color === 'vert') {
    return 'tile-vert';
  }
  if (color === 'rose') {
    return 'tile-rose';
  }
  if (color === 'bleu') {
    return 'tile-bleu';
  }
  if (color === 'rouge') {
    return 'tile-rouge';
  }
  if (color === 'orange') {
    return 'tile-orange';
  }
  return '';
};

const eyeClass = (color) => {
  if (color === 'vert') {
    return 'eyes-sleepy';
  }
  if (color === 'rose') {
    return 'eyes-gear';
  }
  if (color === 'bleu') {
    return 'eyes-diamond';
  }
  if (color === 'rouge') {
    return 'eyes-wink';
  }
  if (color === 'orange') {
    return 'eyes-pill';
  }
  return '';
};

const pointsLabel = (points) => {
  if (points === 1) {
    return '.';
  }
  if (points === 2) {
    return '..';
  }
  if (points === 3) {
    return '...';
  }
  return '';
};

const roleLabel = (role) => {
  if (role === 'HOST') {
    return 'Hôte';
  }
  if (role === 'PLAYER') {
    return 'Joueur';
  }
  return role;
};

const bindSocket = () => {
  const socket = socketService.connect();
  const events = socketService.events;

  socket.on('connect', () => {
    socketState.value = 'connected';
    socket.emit(events.SESSION_JOIN, {
      sessionCode: currentCode.value,
      playerId: store.playerId,
      playerToken: store.playerToken
    });
  });

  socket.on('disconnect', () => {
    socketState.value = 'disconnected';
  });

  socket.io.on('reconnect_attempt', () => {
    socketState.value = 'reconnecting';
  });

  socket.on(events.SESSION_STATE, (payload) => {
    store.updateSessionState(payload);
  });

  socket.on(events.SESSION_ERROR, (payload) => {
    error.value = payload?.message || 'Erreur temps reel';
  });

  socket.on(events.GAME_STARTED, (payload) => {
    store.gameStatus = payload.status;
    if (payload?.state) {
      store.updateSessionState(payload.state);
    }
  });
};

const copyCode = async () => {
  await navigator.clipboard.writeText(currentCode.value);
  copyMessage.value = 'Code copie';
};

const copyLink = async () => {
  await navigator.clipboard.writeText(joinUrl.value);
  copyMessage.value = 'Lien copie';
};

const startGame = async () => {
  error.value = '';
  if (!canStartGame.value) {
    error.value = 'Au moins 2 joueurs connectés sont nécessaires pour démarrer';
    return;
  }

  try {
    const socket = socketService.getSocket();
    if (!socket?.connected) {
      const started = await sessionApi.startSession(currentCode.value, store.playerId, store.playerToken);
      store.gameStatus = started.status || 'PLAYING';
      if (started?.state) {
        store.updateSessionState(started.state);
      }
      return;
    }

    socket.emit(socketService.events.GAME_START, {
      sessionCode: currentCode.value,
      playerId: store.playerId,
      playerToken: store.playerToken
    });
  } catch (requestError) {
    error.value = requestError?.response?.data?.error || 'Demarrage impossible';
  }
};

const leaveSession = async () => {
  error.value = '';
  const socket = socketService.getSocket();

  try {
    if (socket?.connected) {
      socket.emit(socketService.events.SESSION_LEAVE, {
        sessionCode: currentCode.value,
        playerId: store.playerId,
        playerToken: store.playerToken
      });
    } else {
      await sessionApi.leaveSession(currentCode.value, store.playerId, store.playerToken);
    }
  } catch (requestError) {
    error.value = requestError?.response?.data?.error || 'Sortie impossible';
  }

  socketService.disconnect();
  store.clearIdentity();
  await router.push('/');
};

onMounted(async () => {
  updateOrientationState();
  window.addEventListener('resize', updateOrientationState);
  window.addEventListener('orientationchange', updateOrientationState);

  store.hydrateFromStorage();
  const routeCode = extractSessionCode(currentCode.value);

  if (!routeCode) {
    await router.push('/join');
    return;
  }

  if (!store.hasIdentity || normalizeSessionCode(store.sessionCode) !== routeCode) {
    await router.push('/join');
    return;
  }

  try {
    await sessionApi.reconnect(currentCode.value, store.playerId, store.playerToken);
    bindSocket();
  } catch (_error) {
    await router.push('/join');
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateOrientationState);
  window.removeEventListener('orientationchange', updateOrientationState);

  const socket = socketService.getSocket();
  const events = socketService.events;
  if (socket) {
    socket.off(events.SESSION_STATE);
    socket.off(events.SESSION_ERROR);
    socket.off(events.GAME_STARTED);
  }
});
</script>

<style scoped>
.lobby-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.session-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
}

h2,
h3,
p {
  margin: 0;
}

.actions-inline {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.players {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #111827;
}

.online {
  color: #9dffbf;
}

.offline {
  color: #ff8ea2;
}

.start-suggestion {
  color: #9dffbf;
  font-weight: 600;
}

.start-hint {
  color: #ffd783;
}

.rotate-prompt {
  min-height: 52vh;
  align-content: center;
  justify-items: center;
  text-align: center;
}

.rotate-icon {
  position: relative;
  width: 78px;
  height: 78px;
  margin: 0 auto 6px;
}

.phone-shape {
  position: absolute;
  top: 18px;
  left: 25px;
  width: 30px;
  height: 42px;
  border: 3px solid #d9f1ff;
  border-radius: 8px;
  box-shadow: inset 0 0 0 2px rgba(217, 241, 255, 0.12);
  transform: rotate(-32deg);
}

.rotate-arrow {
  position: absolute;
  top: 12px;
  left: 8px;
  width: 62px;
  height: 62px;
  border: 4px solid transparent;
  border-top-color: #9dffbf;
  border-left-color: #9dffbf;
  border-radius: 50%;
  transform: rotate(12deg);
}

.rotate-arrow::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 2px;
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 12px solid #9dffbf;
  transform: rotate(-40deg);
}

.tiles-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
}

.tile-card {
  position: relative;
  flex: 0 0 64px;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0;
  aspect-ratio: 1 / 1;
  min-height: 64px;
  padding: 8px 5px 6px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 -4px 10px rgba(0, 0, 0, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.38), 0 6px 16px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.tile-card::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 8px;
  right: 8px;
  height: 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.48) 0%, rgba(255, 255, 255, 0.06) 100%);
  pointer-events: none;
}

.tile-eyes {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
}

.eye {
  display: block;
  width: 16px;
  height: 10px;
  color: #ffffff;
  background: #ffffff;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.65), 0 0 0 1px rgba(80, 0, 60, 0.12);
  transform-origin: center center;
  --eye-base-transform: none;
  animation: eye-blink 5.6s ease-in-out infinite;
  transform: var(--eye-base-transform);
}

.eye-left {
  animation-delay: 0.2s;
}

.eye-right {
  animation-delay: 0.6s;
}

.eye::after {
  content: '';
  display: block;
  width: 5px;
  height: 5px;
  background: #8b0f58;
}

.eyes-diamond .eye {
  width: 18px;
  height: 18px;
  --eye-base-transform: rotate(45deg);
  border-radius: 1px;
}

.eyes-diamond .eye::after {
  width: 8px;
  height: 8px;
  margin: 1px auto;
  border-radius: 1px;
}

.eyes-gear .eye {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  clip-path: polygon(50% 0%, 61% 10%, 75% 5%, 80% 18%, 94% 24%, 89% 38%, 100% 50%, 89% 62%, 94% 76%, 80% 82%, 75% 95%, 61% 90%, 50% 100%, 39% 90%, 25% 95%, 20% 82%, 6% 76%, 11% 62%, 0% 50%, 11% 38%, 6% 24%, 20% 18%, 25% 5%, 39% 10%);
}

.eyes-gear .eye::after {
  width: 8px;
  height: 8px;
  margin: 6px;
  border-radius: 50%;
}

.eyes-pill .eye {
  width: 15px;
  height: 25px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
}

.eyes-pill .eye::after {
  width: 8px;
  height: 8px;
  margin: 14px auto 0;
  border-radius: 4px;
}

.eyes-sleepy .eye {
  width: 27px;
  height: 12px;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  border-bottom-left-radius: 2px;
  border-bottom-right-radius: 2px;
}

.eyes-sleepy .eye::after {
  width: 9px;
  height: 9px;
  margin: 2px auto 0;
  border-radius: 50%;
}

.eyes-wink {
  gap: 9px;
}

.eyes-wink .eye-left {
  width: 27px;
  height: 16px;
  border-radius: 16px;
}

.eyes-wink .eye-left::after {
  width: 10px;
  height: 10px;
  margin: 3px;
  border-radius: 50%;
}

.eyes-wink .eye-right {
  width: 22px;
  height: 9px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
  margin-top: 7px;
}

.eyes-wink .eye-right::after {
  width: 9px;
  height: 5px;
  margin: 2px auto;
  border-radius: 0 0 6px 6px;
}

@keyframes eye-blink {
  0%,
  86%,
  100% {
    transform: var(--eye-base-transform) scaleY(1);
  }
  90% {
    transform: var(--eye-base-transform) scaleY(0.12);
  }
  93% {
    transform: var(--eye-base-transform) scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .eye {
    animation: none;
  }
}

.tile-vert {
  background: linear-gradient(180deg, #22f07f 0%, #12cc66 100%);
}

.tile-rose {
  background: linear-gradient(180deg, #ff87df 0%, #ff5bc8 100%);
}

.tile-bleu {
  background: linear-gradient(180deg, #3fe3ff 0%, #17bde3 100%);
}

.tile-rouge {
  background: linear-gradient(180deg, #ff5f4f 0%, #f03b2a 100%);
}

.tile-orange {
  background: linear-gradient(180deg, #ffbf3f 0%, #ff9d17 100%);
}

.reference-board {
  gap: 6px;
  min-height: 0;
}

.reference-row {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
}

.reference-tile {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  min-height: 40px;
  display: grid;
  align-content: center;
  justify-items: center;
  grid-template-rows: auto auto;
  line-height: 1;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.reference-tile strong {
  font-size: clamp(1.42rem, 2.1vw, 1.9rem);
  font-weight: 900;
  line-height: 0.8;
  max-width: 100%;
  white-space: nowrap;
  color: #fff8e8;
  text-shadow: -1px -1px 0 #562452, 1px -1px 0 #562452, -1px 1px 0 #562452, 1px 1px 0 #562452, 0 1px 0 #562452;
}

.reference-tile small {
  margin-top: 1px;
  font-size: clamp(1.22rem, 1.9vw, 1.5rem);
  font-weight: 900;
  line-height: 0.72;
  max-width: 100%;
  white-space: nowrap;
  letter-spacing: 0.08em;
  color: #fff8e8;
  text-shadow: -1px -1px 0 #562452, 1px -1px 0 #562452, -1px 1px 0 #562452, 1px 1px 0 #562452, 0 1px 0 #562452;
}

@media (max-width: 900px) and (orientation: landscape) {
  .playing-layout {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    max-height: calc(100dvh - 16px);
    overflow: hidden;
    gap: 6px;
  }

  .reference-board {
    overflow: auto;
    padding-right: 2px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .tiles-grid {
    gap: 5px;
  }

  .tile-card {
    flex-basis: 56px;
    min-height: 56px;
  }

  .tile-eyes {
    margin-top: 2px;
  }

  .reference-row {
    gap: 3px;
  }

  .reference-tile {
    min-height: 31px;
  }

  .reference-tile strong {
    font-size: clamp(1.16rem, 2.75vw, 1.42rem);
  }

  .reference-tile small {
    font-size: clamp(1.04rem, 2.45vw, 1.28rem);
  }
}
</style>
