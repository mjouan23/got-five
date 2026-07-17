<template>
  <section class="card hero stack">
    <img class="hero-logo" src="/logo.png" alt="Logo Got Five" />
    <h2>Meeplix</h2>
    <div class="stack actions">
      <RouterLink class="btn link-btn" to="/create">Creer une partie</RouterLink>
      <RouterLink class="btn secondary link-btn" to="/join">Rejoindre une partie</RouterLink>
    </div>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router';
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

.actions {
  margin-top: 10px;
}

.link-btn {
  text-decoration: none;
  display: inline-flex;
  justify-content: center;
}
</style>
