<template>
  <header class="header">
    <div class="brand">
      <img class="logo" src="/logo.png" alt="Logo Got Five" />
      <div>
        <h1>Got five!</h1>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(69, 240, 165, 0.2);
  background: rgba(7, 9, 12, 0.9);
  position: sticky;
  top: 0;
  backdrop-filter: blur(4px);
  z-index: 10;
}

.brand {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  object-fit: cover;
}

h1 {
  margin: 0;
  font-size: 1.15rem;
}
</style>
