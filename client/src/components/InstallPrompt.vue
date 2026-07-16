<template>
  <button v-if="canInstall" class="btn secondary" type="button" @click="install">
    Installer l'application
  </button>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const deferredPrompt = ref(null);
const canInstall = ref(false);

const install = async () => {
  if (!deferredPrompt.value) {
    return;
  }
  deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice;
  deferredPrompt.value = null;
  canInstall.value = false;
};

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt.value = event;
    canInstall.value = true;
  });
});
</script>
