<template>
  <div class="stack card">
    <div class="scanner-head">
      <h3>Scanner un QR Code</h3>
      <button class="btn secondary small" type="button" @click="stopScanner">Fermer</button>
    </div>
    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    <div :id="scannerElementId" class="scanner"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';

const emits = defineEmits(['detected', 'close']);

const scannerElementId = `qr-reader-${Math.random().toString(16).slice(2)}`;
const errorMessage = ref('');
let scanner = null;

const stopScanner = async () => {
  if (scanner) {
    const running = scanner.isScanning;
    if (running) {
      await scanner.stop();
    }
    await scanner.clear();
    scanner = null;
  }
  emits('close');
};

const startScanner = async () => {
  try {
    scanner = new Html5Qrcode(scannerElementId);
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (decodedText) => {
        if (scanner?.isScanning) {
          await scanner.stop();
        }
        emits('detected', decodedText);
      },
      () => {}
    );
  } catch (_error) {
    errorMessage.value = 'Camera non autorisee ou indisponible. Utilisez la saisie manuelle.';
  }
};

onMounted(startScanner);
onBeforeUnmount(async () => {
  if (scanner && scanner.isScanning) {
    await scanner.stop();
  }
  if (scanner) {
    await scanner.clear();
  }
});
</script>

<style scoped>
.scanner-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.scanner {
  min-height: 260px;
}

.small {
  width: auto;
  padding: 10px 12px;
}

h3 {
  margin: 0;
}
</style>
