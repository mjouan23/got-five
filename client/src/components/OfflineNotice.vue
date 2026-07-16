<template>
  <p v-if="!isOnline" class="offline-banner">
    Vous etes hors ligne. Le mode multijoueur necessite une connexion serveur active.
  </p>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const isOnline = ref(window.navigator.onLine);

const updateOnlineStatus = () => {
  isOnline.value = window.navigator.onLine;
};

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<style scoped>
.offline-banner {
  position: sticky;
  bottom: 0;
  margin: 0;
  text-align: center;
  padding: 10px 12px;
  background: rgba(255, 84, 112, 0.16);
  border-top: 1px solid rgba(255, 84, 112, 0.55);
  color: #ffd6de;
}
</style>
