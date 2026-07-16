<template>
  <section class="card hero stack">
    <img class="hero-logo" src="/logo.png" alt="Logo Got Five" />
    <h2>Got Five!</h2>
    <p>Jeu de societe multijoueur en temps reel sur smartphone.</p>
    <InstallPrompt />
    <div class="stack actions">
      <RouterLink class="btn link-btn" to="/create">Creer une partie</RouterLink>
      <RouterLink class="btn secondary link-btn" to="/join">Rejoindre une partie</RouterLink>
    </div>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import InstallPrompt from '../components/InstallPrompt.vue';
</script>

<style scoped>
.hero {
  text-align: center;
  margin-top: 28px;
}

.hero-logo {
  width: 128px;
  height: 128px;
  margin: 0 auto;
  border-radius: 24px;
  object-fit: cover;
  border: 1px solid rgba(69, 240, 165, 0.28);
}

h2 {
  margin: 0;
  font-size: 2rem;
}

p {
  margin: 0;
  color: var(--muted);
}

.actions {
  margin-top: 10px;
}

.link-btn {
  text-decoration: none;
  display: inline-flex;
  justify-content: center;
}
</style>
