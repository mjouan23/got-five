<template>
  <section class="card stack">
    <h2>Rejoindre {{ normalizedCode }}</h2>
    <p>Ce lien provient d'un QR Code. Saisissez uniquement votre pseudonyme.</p>

    <form class="stack" @submit.prevent="join">
      <label class="field">
        <span>Pseudonyme</span>
        <input v-model="nickname" class="input" maxlength="20" autocomplete="nickname" required />
      </label>

      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? 'Connexion...' : 'Rejoindre la session' }}
      </button>
    </form>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sessionApi } from '../services/api';
import { normalizeSessionCode } from '../composables/useSessionCode';
import { useSessionStore } from '../stores/sessionStore';

const route = useRoute();
const router = useRouter();
const store = useSessionStore();

const nickname = ref('');
const loading = ref(false);
const error = ref('');

const normalizedCode = computed(() => normalizeSessionCode(route.params.sessionCode));

onMounted(async () => {
  try {
    await store.ensureSessionExists(normalizedCode.value);
  } catch (_error) {
    error.value = 'Session introuvable';
  }
});

const join = async () => {
  loading.value = true;
  error.value = '';

  try {
    const payload = await sessionApi.joinSession(normalizedCode.value, nickname.value);
    store.setIdentity({ ...payload, nickname: nickname.value });
    await router.push(`/game/${payload.sessionCode}`);
  } catch (requestError) {
    error.value = requestError?.response?.data?.error || 'Connexion impossible';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
h2,
p {
  margin: 0;
}

p {
  color: var(--muted);
}
</style>
