<template>
  <section class="stack">
    <article class="card stack">
      <h2>Rejoindre une partie</h2>
      <p>Choisissez le scan QR ou la saisie manuelle.</p>

      <button class="btn secondary" type="button" @click="scannerOpen = !scannerOpen">
        {{ scannerOpen ? 'Fermer le scanner' : 'Scanner un QR Code' }}
      </button>

      <QrScanner v-if="scannerOpen" @detected="onDetected" @close="scannerOpen = false" />
      <p v-if="scannerError" class="error-text">{{ scannerError }}</p>
    </article>

    <article class="card stack">
      <h3>Saisie manuelle</h3>
      <form class="stack" @submit.prevent="join">
        <label class="field">
          <span>Code session</span>
          <input v-model="sessionCode" class="input" maxlength="6" required />
        </label>

        <label class="field">
          <span>Pseudonyme</span>
          <input v-model="nickname" class="input" maxlength="20" autocomplete="nickname" required />
        </label>

        <p v-if="error" class="error-text">{{ error }}</p>
        <button class="btn" type="submit" :disabled="loading">
          {{ loading ? 'Connexion...' : 'Rejoindre' }}
        </button>
      </form>
    </article>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { sessionApi } from '../services/api';
import { extractCodeFromUrl, extractSessionCode } from '../composables/useSessionCode';
import QrScanner from '../components/QrScanner.vue';
import { useSessionStore } from '../stores/sessionStore';

const router = useRouter();
const store = useSessionStore();

const scannerOpen = ref(false);
const scannerError = ref('');
const sessionCode = ref('');
const nickname = ref('');
const loading = ref(false);
const error = ref('');

const onDetected = (decodedText) => {
  const code = extractCodeFromUrl(decodedText);
  if (!code) {
    scannerError.value = 'QR Code invalide pour Got Five!';
    return;
  }
  router.push(`/join/${code}`);
};

const join = async () => {
  loading.value = true;
  error.value = '';

  try {
    const normalizedCode = extractSessionCode(sessionCode.value);
    if (!normalizedCode) {
      error.value = 'Le code session doit contenir 6 caracteres valides';
      return;
    }

    const payload = await sessionApi.joinSession(normalizedCode, nickname.value);
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
h3,
p {
  margin: 0;
}

p {
  color: var(--muted);
}
</style>
