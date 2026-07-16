<template>
  <section class="stack">
    <article class="card stack">
      <div class="lobby-top">
        <img class="session-logo" src="/logo.png" alt="Logo Got Five" />
        <div>
          <h2>Salon {{ currentCode }}</h2>
          <ConnectionStatus :status="socketState" />
        </div>
      </div>

      <div class="stack">
        <p>Code session: <strong>{{ currentCode }}</strong></p>
        <QrCodeBlock :value="joinUrl" />

        <div class="stack actions-inline">
          <button class="btn secondary" type="button" @click="copyCode">Copier le code</button>
          <button class="btn secondary" type="button" @click="copyLink">Copier le lien</button>
        </div>
      </div>

      <p v-if="copyMessage" class="success-text">{{ copyMessage }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </article>

    <article class="card stack">
      <h3>Joueurs connectes</h3>
      <ul class="players">
        <li v-for="player in store.players" :key="player.id" class="player-row">
          <span>{{ player.nickname }} <small>({{ player.role }})</small></span>
          <span :class="player.connected ? 'online' : 'offline'">
            {{ player.connected ? 'En ligne' : 'Hors ligne' }}
          </span>
        </li>
      </ul>

      <button v-if="store.isHost" class="btn" type="button" @click="startGame">
        Commencer la partie
      </button>
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

const route = useRoute();
const router = useRouter();
const store = useSessionStore();

const socketState = ref('disconnected');
const copyMessage = ref('');
const error = ref('');

const currentCode = computed(() => normalizeSessionCode(route.params.sessionCode));
const appHost = window.location.hostname;
const useRuntimeOrigin = appHost === 'localhost' || appHost === '127.0.0.1';
const publicUrl = useRuntimeOrigin
  ? window.location.origin
  : import.meta.env.VITE_PUBLIC_URL || window.location.origin;
const joinUrl = computed(() => `${publicUrl.replace(/\/$/, '')}/join/${currentCode.value}`);

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
  try {
    const socket = socketService.getSocket();
    if (!socket?.connected) {
      await sessionApi.startSession(currentCode.value, store.playerId, store.playerToken);
      store.gameStatus = 'PLAYING';
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
</style>
