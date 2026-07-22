<template>
  <section class="stack">
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

      <ul class="tiles-grid face-up-grid" aria-label="Tuiles visibles communes">
        <li
          v-for="tile in sharedFaceUpTilesDisplay"
          :key="tile.id"
          class="tile-card tile-face-up"
          :class="colorClass(tile.couleur)"
        >
          <strong class="tile-face-value">{{ tile.chiffre }}</strong>
          <small class="tile-face-points">{{ pointsLabel(tile.nombrePoints) }}</small>
        </li>
        <li
          v-if="sharedFaceUpTilesDisplay.length < 6"
          class="tile-card tile-reserved"
          aria-label="Emplacement reserve pour une 6eme tuile"
        />
      </ul>

      <section class="reference-board stack" aria-label="Tableau des 60 tuiles">
        <ul class="reference-row" v-for="row in referenceRows" :key="row.color">
          <li
            v-for="tile in row.tiles"
            :key="tile.chiffre"
            class="reference-tile"
            :class="[
              colorClass(tile.couleur),
              {
                'reference-tile-crossed': isCrossedNumber(tile.chiffre),
                'reference-tile-markable': isMarkableNumber(tile.chiffre),
                'reference-tile-manual': isManuallyMarked(tile.chiffre)
              }
            ]"
            :tabindex="isMarkableNumber(tile.chiffre) ? 0 : -1"
            role="button"
            @click="toggleManualCrossBar(tile.chiffre)"
            @keydown.enter.prevent="toggleManualCrossBar(tile.chiffre)"
            @keydown.space.prevent="toggleManualCrossBar(tile.chiffre)"
          >
            <strong>{{ tile.chiffre }}</strong>
            <small>{{ pointsLabel(tile.nombrePoints) }}</small>
          </li>
        </ul>
      </section>

      <div class="draw-actions" aria-label="Pioche de tuiles par couleur">
        <button
          v-for="entry in availableDrawButtons"
          :key="entry.color"
          class="btn draw-btn"
          :class="colorClass(entry.color)"
          type="button"
          :disabled="isDrawing || !isCurrentTurn"
          @click="drawTile(entry.color)"
        >
          Piocher
        </button>
        <button class="btn propose-btn" type="button" :disabled="isDrawing || !isCurrentTurn">Proposer !</button>
      </div>

      <p v-if="!playerTiles.length" class="start-hint">Attribution des nombres en cours...</p>
      <button class="btn secondary" type="button" @click="leaveSession">Quitter la partie</button>
    </article>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
const manualMarkedNumbers = ref([]);
const isDrawing = ref(false);

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
const sharedFaceUpTiles = computed(() => store.sharedFaceUpTiles || []);
const crossedNumbers = computed(
  () => new Set((store.currentCrossedNumbers || []).map((value) => Number(value)))
);
const manualMarkedSet = computed(() => new Set(manualMarkedNumbers.value.map((value) => Number(value))));
const remainingTilesByColor = computed(() => store.remainingTilesByColor || {});
const colorOrder = ['vert', 'rose', 'bleu', 'rouge', 'orange'];
const isCurrentTurn = computed(() => Boolean(store.playerId) && store.playerId === store.currentTurnPlayerId);
const displayTiles = computed(() => {
  if (playerTiles.value.length) {
    return playerTiles.value;
  }
  return colorOrder.map((color, index) => ({
    id: `placeholder-${color}-${index + 1}`,
    couleur: color
  }));
});
const sharedFaceUpTilesDisplay = computed(() => {
  if (sharedFaceUpTiles.value.length) {
    return sharedFaceUpTiles.value.slice(0, 6);
  }

  return colorOrder.map((color, index) => ({
    id: `shared-placeholder-${color}-${index + 1}`,
    chiffre: '?',
    couleur: color,
    nombrePoints: 0
  }));
});
const availableDrawButtons = computed(() =>
  colorOrder
    .map((color) => ({
      color,
      remaining: Number(remainingTilesByColor.value[color] || 0)
    }))
    .filter((entry) => entry.remaining > 0)
);
const referenceRows = computed(() =>
  colorOrder.map((color) => ({
    color,
    tiles: [...tilesData]
      .filter((tile) => tile.couleur === color)
      .sort((first, second) => first.chiffre - second.chiffre)
  }))
);

const lockLandscapeIfPossible = async () => {
  const orientationApi = screen.orientation;
  if (!orientationApi || typeof orientationApi.lock !== 'function') {
    return;
  }

  try {
    await orientationApi.lock('landscape');
  } catch (_error) {
    // Some devices/browsers (notably iOS Safari/PWA) can refuse programmatic lock.
  }
};

const requestFullscreenIfPossible = async () => {
  const rootElement = document.documentElement;
  if (!rootElement || document.fullscreenElement || typeof rootElement.requestFullscreen !== 'function') {
    return;
  }

  try {
    await rootElement.requestFullscreen();
  } catch (_error) {
    // Fullscreen can be blocked by browser policy depending on platform/context.
  }
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

const isCrossedNumber = (value) => crossedNumbers.value.has(Number(value));
const isMarkableNumber = (value) => !isCrossedNumber(value);
const isManuallyMarked = (value) => isMarkableNumber(value) && manualMarkedSet.value.has(Number(value));

const toggleManualCrossBar = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || isCrossedNumber(numberValue)) {
    return;
  }

  const draft = new Set(manualMarkedNumbers.value.map((entry) => Number(entry)));
  if (draft.has(numberValue)) {
    draft.delete(numberValue);
  } else {
    draft.add(numberValue);
  }

  manualMarkedNumbers.value = [...draft].sort((first, second) => first - second);
};

const drawTile = async (color) => {
  if (isDrawing.value) {
    return;
  }

  error.value = '';
  isDrawing.value = true;

  try {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit(socketService.events.GAME_DRAW, {
        sessionCode: currentCode.value,
        playerId: store.playerId,
        playerToken: store.playerToken,
        color
      });
      return;
    }

    const response = await sessionApi.drawSharedTile(currentCode.value, store.playerId, store.playerToken, color);
    if (response?.state) {
      store.updateSessionState(response.state);
    }
  } catch (requestError) {
    error.value = requestError?.response?.data?.error || 'Pioche impossible';
  } finally {
    isDrawing.value = false;
  }
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
    isDrawing.value = false;
  });

  socket.on(events.GAME_STARTED, (payload) => {
    store.gameStatus = payload.status;
    if (payload?.state) {
      store.updateSessionState(payload.state);
    }
  });

  socket.on(events.GAME_DRAWN, (payload) => {
    if (payload?.state) {
      store.updateSessionState(payload.state);
    }
    isDrawing.value = false;
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
      await requestFullscreenIfPossible();
      await lockLandscapeIfPossible();
      return;
    }

    socket.emit(socketService.events.GAME_START, {
      sessionCode: currentCode.value,
      playerId: store.playerId,
      playerToken: store.playerToken
    });
    await requestFullscreenIfPossible();
    await lockLandscapeIfPossible();
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

  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    try {
      await document.exitFullscreen();
    } catch (_error) {
      // No-op if browser denies fullscreen exit.
    }
  }

  await router.push('/');
};

onMounted(async () => {
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
    if (isPlaying.value) {
      await requestFullscreenIfPossible();
      await lockLandscapeIfPossible();
    }
  } catch (_error) {
    await router.push('/join');
  }
});

onBeforeUnmount(() => {
  const socket = socketService.getSocket();
  const events = socketService.events;
  if (socket) {
    socket.off(events.SESSION_STATE);
    socket.off(events.SESSION_ERROR);
    socket.off(events.GAME_STARTED);
    socket.off(events.GAME_DRAWN);
  }
});

watch(isPlaying, async (playing) => {
  if (playing) {
    await requestFullscreenIfPossible();
    await lockLandscapeIfPossible();
  }
});

watch(
  () => store.currentCrossedNumbers,
  (numbers) => {
    const blocked = new Set((numbers || []).map((value) => Number(value)));
    manualMarkedNumbers.value = manualMarkedNumbers.value.filter(
      (value) => !blocked.has(Number(value))
    );
  },
  { immediate: true }
);
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

.playing-layout.card {
  padding: 0;
  gap: 2px;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.tiles-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
}

.tile-card {
  position: relative;
  flex: 0 0 48px;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0;
  aspect-ratio: 1 / 1;
  min-height: 48px;
  padding: 5px 3px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 -2px 6px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.32);
  overflow: hidden;
}

.face-up-grid {
  gap: 4px;
}

.tile-face-up {
  align-content: center;
  justify-items: center;
  grid-template-rows: auto auto;
  gap: 1px;
}

.tile-face-value {
  font-size: 1.46rem;
  line-height: 0.82;
  font-weight: 900;
  color: #fff8e8;
  text-shadow: -1px -1px 0 #562452, 1px -1px 0 #562452, -1px 1px 0 #562452, 1px 1px 0 #562452;
}

.tile-face-points {
  font-size: 0.94rem;
  line-height: 0.72;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fff8e8;
  text-shadow: -1px -1px 0 #562452, 1px -1px 0 #562452, -1px 1px 0 #562452, 1px 1px 0 #562452;
}

.tile-reserved {
  background: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0,
    rgba(255, 255, 255, 0.1) 5px,
    rgba(255, 255, 255, 0.04) 5px,
    rgba(255, 255, 255, 0.04) 10px
  );
  border: 1px dashed rgba(255, 255, 255, 0.38);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
}

.tile-card::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 5px;
  right: 5px;
  height: 6px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.48) 0%, rgba(255, 255, 255, 0.06) 100%);
  pointer-events: none;
}

.tile-eyes {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  margin-top: 2px;
  max-width: 100%;
  overflow: hidden;
}

.eye {
  display: block;
  width: 9px;
  height: 6px;
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
  width: 3px;
  height: 3px;
  background: #8b0f58;
}

.eyes-diamond .eye {
  width: 10px;
  height: 10px;
  --eye-base-transform: rotate(45deg);
  border-radius: 1px;
}

.eyes-diamond .eye::after {
  width: 4px;
  height: 4px;
  margin: 1px auto;
  border-radius: 1px;
}

.eyes-gear .eye {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  clip-path: polygon(50% 0%, 61% 10%, 75% 5%, 80% 18%, 94% 24%, 89% 38%, 100% 50%, 89% 62%, 94% 76%, 80% 82%, 75% 95%, 61% 90%, 50% 100%, 39% 90%, 25% 95%, 20% 82%, 6% 76%, 11% 62%, 0% 50%, 11% 38%, 6% 24%, 20% 18%, 25% 5%, 39% 10%);
}

.eyes-gear .eye::after {
  width: 4px;
  height: 4px;
  margin: 4px;
  border-radius: 50%;
}

.eyes-pill .eye {
  width: 8px;
  height: 14px;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom-left-radius: 2px;
  border-bottom-right-radius: 2px;
}

.eyes-pill .eye::after {
  width: 3px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 4px;
}

.eyes-sleepy .eye {
  width: 14px;
  height: 7px;
  border-top-left-radius: 7px;
  border-top-right-radius: 7px;
  border-bottom-left-radius: 1px;
  border-bottom-right-radius: 1px;
}

.eyes-sleepy .eye::after {
  width: 4px;
  height: 4px;
  margin: 1px auto 0;
  border-radius: 50%;
}

.eyes-wink {
  gap: 4px;
}

.eyes-wink .eye-left {
  width: 14px;
  height: 8px;
  border-radius: 8px;
}

.eyes-wink .eye-left::after {
  width: 4px;
  height: 4px;
  margin: 2px;
  border-radius: 50%;
}

.eyes-wink .eye-right {
  width: 12px;
  height: 6px;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  border-bottom-left-radius: 2px;
  border-bottom-right-radius: 2px;
  margin-top: 3px;
}

.eyes-wink .eye-right::after {
  width: 4px;
  height: 3px;
  margin: 1px auto;
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
  width: 85%;
  margin: 0 auto;
  padding: 15px;
  gap: 2px;
  min-height: 0;
}

.draw-actions {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 4px;
}

.draw-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 6px 4px;
  color: #111827;
  font-weight: 800;
  font-size: 0.78rem;
  line-height: 1.1;
  white-space: nowrap;
  border: 1px solid rgba(0, 0, 0, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.draw-btn:disabled {
  opacity: 0.55;
}

.propose-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 6px 4px;
  font-size: 0.78rem;
  line-height: 1.1;
  white-space: nowrap;
  font-weight: 900;
  color: #fff8e8;
  background: linear-gradient(180deg, #6d28d9 0%, #5b21b6 100%);
  border: 1px solid rgba(20, 8, 45, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 2px 8px rgba(24, 10, 58, 0.28);
}

.reference-row {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 5px;
}

.reference-tile {
  position: relative;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  aspect-ratio: 1 / 1;
  min-height: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  grid-template-rows: auto auto;
  line-height: 1;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.reference-tile-crossed::before,
.reference-tile-crossed::after {
  content: '';
  position: absolute;
  top: 0;
  width: 142%;
  height: 3.5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.88);
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.reference-tile-crossed::before {
  left: 0;
  transform-origin: 0 0;
  transform: translate(-1px, -1px) rotate(45deg);
}

.reference-tile-crossed::after {
  right: 0;
  transform-origin: 100% 0;
  transform: translate(1px, -1px) rotate(-45deg);
}

.reference-tile-markable {
  cursor: pointer;
}

.reference-tile-manual::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 142%;
  height: 3.5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.88);
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.4);
  transform-origin: 0 0;
  transform: translate(-1px, -1px) rotate(45deg);
  pointer-events: none;
}

.reference-tile strong {
  font-size: clamp(1.3rem, 4vw, 1.6rem);
  font-weight: 900;
  line-height: 0.8;
  max-width: 100%;
  white-space: nowrap;
  color: #fff8e8;
  text-shadow: -1px -1px 0 #562452, 1px -1px 0 #562452, -1px 1px 0 #562452, 1px 1px 0 #562452, 0 1px 0 #562452;
}

.reference-tile small {
  margin-top: 1px;
  font-size: clamp(1.2rem, 5vw, 1.08rem);
  font-weight: 900;
  line-height: 0.6;
  max-width: 100%;
  white-space: nowrap;
  letter-spacing: 0.08em;
  color: #fff8e8;
  text-shadow: -1px -1px 0 #562452, 1px -1px 0 #562452, -1px 1px 0 #562452, 1px 1px 0 #562452, 0 1px 0 #562452;
}

@media (max-width: 900px) and (orientation: landscape) {
  .playing-layout {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    max-height: calc(100dvh - 14px);
    overflow: hidden;
    gap: 2px;
    padding: 2px;
  }

  .playing-layout.card {
    padding: 2px;
  }

  .reference-board {
    overflow: auto;
    width: 91%;
    padding-right: 0;
    min-height: 0;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .draw-actions {
    gap: 4px;
  }

  .draw-btn {
    padding: 5px 3px;
    font-size: 0.72rem;
  }

  .propose-btn {
    padding: 5px 3px;
    font-size: 0.72rem;
  }

  .tiles-grid {
    gap: 3px;
  }

  .tile-card {
    flex-basis: 42px;
    min-height: 42px;
  }

  .tile-face-value {
    font-size: 1.28rem;
  }

  .tile-face-points {
    font-size: 0.84rem;
  }

  .tile-eyes {
    margin-top: 1px;
  }

  .reference-row {
    gap: 2px;
  }

  .reference-tile {
    min-height: 0;
  }

  .reference-tile strong {
    font-size: clamp(1.16rem, 2.75vw, 1.42rem);
  }

  .reference-tile small {
    font-size: clamp(1.04rem, 2.45vw, 1.28rem);
  }
}

@media (max-width: 900px) and (orientation: landscape) and (max-height: 430px) {
  .playing-layout {
    max-height: calc(100dvh - 8px);
    gap: 2px;
    padding: 1px;
  }

  .tile-card {
    flex-basis: 38px;
    min-height: 38px;
  }

  .draw-btn {
    padding: 4px 2px;
    font-size: 0.66rem;
  }

  .propose-btn {
    padding: 4px 2px;
    font-size: 0.66rem;
  }

  .tile-face-value {
    font-size: 1.1rem;
  }

  .tile-face-points {
    font-size: 0.74rem;
  }

  .reference-row {
    gap: 2px;
  }

  .reference-tile {
    min-height: 0;
  }

  .reference-tile strong {
    font-size: clamp(1rem, 2.35vw, 1.2rem);
  }

  .reference-tile small {
    font-size: clamp(0.9rem, 2.05vw, 1.08rem);
  }
}

@media (max-width: 900px) and (orientation: landscape) and (min-height: 431px) and (max-height: 520px) {
  .playing-layout {
    max-height: calc(100dvh - 10px);
    gap: 5px;
  }

  .tile-card {
    flex-basis: 40px;
    min-height: 40px;
  }

  .draw-btn {
    font-size: 0.7rem;
  }

  .propose-btn {
    font-size: 0.7rem;
  }

  .tile-face-value {
    font-size: 1.18rem;
  }

  .tile-face-points {
    font-size: 0.8rem;
  }

  .reference-tile {
    min-height: 0;
  }
}

@media (max-width: 900px) and (orientation: landscape) and (min-height: 521px) {
  .playing-layout {
    max-height: calc(100dvh - 12px);
  }
}

@media (max-width: 900px) {
  .reference-board {
    overflow: auto;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
