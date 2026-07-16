<template>
  <section class="card stack">
    <h2>Creer une partie</h2>
    <p>Saisissez votre pseudonyme pour devenir l'organisateur.</p>

    <form class="stack" @submit.prevent="create">
      <label class="field">
        <span>Pseudonyme</span>
        <input v-model="nickname" class="input" maxlength="20" autocomplete="nickname" required />
      </label>

      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? 'Creation...' : 'Creer la partie' }}
      </button>
    </form>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { sessionApi } from '../services/api';
import { useSessionStore } from '../stores/sessionStore';

const router = useRouter();
const store = useSessionStore();

const nickname = ref('');
const loading = ref(false);
const error = ref('');

const create = async () => {
  loading.value = true;
  error.value = '';

  try {
    const payload = await sessionApi.createSession(nickname.value);
    store.setIdentity({ ...payload, nickname: nickname.value });
    await router.push(`/game/${payload.sessionCode}`);
  } catch (requestError) {
    error.value = requestError?.response?.data?.error || 'Creation impossible';
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
