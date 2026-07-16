<template>
  <div class="qr-wrap stack">
    <canvas ref="canvasEl"></canvas>
    <p class="url">{{ value }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = defineProps({
  value: {
    type: String,
    required: true
  }
});

const canvasEl = ref(null);

const render = async () => {
  if (!canvasEl.value || !props.value) {
    return;
  }
  await QRCode.toCanvas(canvasEl.value, props.value, {
    width: 220,
    margin: 1,
    color: {
      dark: '#f5f7fa',
      light: '#00000000'
    }
  });
};

onMounted(render);
watch(() => props.value, render);
</script>

<style scoped>
.qr-wrap {
  justify-items: center;
}

.url {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
  word-break: break-all;
}
</style>
