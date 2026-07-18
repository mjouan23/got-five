<template>
  <div class="app-shell">
    <AppHeader v-if="showHeader" />
    <main class="app-main">
      <RouterView />
    </main>
    <OfflineNotice />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import OfflineNotice from './components/OfflineNotice.vue';
import { useSessionStore } from './stores/sessionStore';

const route = useRoute();
const sessionStore = useSessionStore();

const showHeader = computed(() => {
  const isGameScreen = route.name === 'game';
  const isPlaying = sessionStore.gameStatus === 'PLAYING';
  return !(isGameScreen && isPlaying);
});
</script>
