<template>
  <div class="app-shell" :class="{ 'fullscreen-mode': isGameFullscreen }">
    <AppHeader v-if="showHeader" />
    <main class="app-main" :class="{ 'fullscreen-main': isGameFullscreen }">
      <RouterView />
    </main>
    <OfflineNotice v-if="!isGameFullscreen" />
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

const isGameFullscreen = computed(() => {
  const isGameScreen = route.name === 'game';
  const isPlaying = sessionStore.gameStatus === 'PLAYING';
  return isGameScreen && isPlaying;
});
</script>
