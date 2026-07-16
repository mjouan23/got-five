<template>
  <section class="card stack">
    <h2>Page introuvable</h2>
    <RouterLink class="btn link-btn" to="/">Retour a l'accueil</RouterLink>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router';
</script>

<style scoped>
h2 {
  margin: 0;
}

.link-btn {
  text-decoration: none;
  display: inline-flex;
  justify-content: center;
}
</style>
