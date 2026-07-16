<template>
  <span class="badge" :class="statusClass">
    {{ statusLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    required: true
  }
});

const statusLabel = computed(() => {
  if (props.status === 'connected') {
    return 'Connecte';
  }
  if (props.status === 'reconnecting') {
    return 'Reconnexion en cours';
  }
  return 'Deconnecte';
});

const statusClass = computed(() => {
  if (props.status === 'connected') {
    return 'ok';
  }
  if (props.status === 'reconnecting') {
    return 'warn';
  }
  return 'off';
});
</script>

<style scoped>
.ok {
  border-color: rgba(64, 215, 127, 0.6);
  color: #9dffbf;
}

.warn {
  border-color: rgba(255, 205, 92, 0.7);
  color: #ffd783;
}

.off {
  border-color: rgba(255, 84, 112, 0.6);
  color: #ff8ea2;
}
</style>
