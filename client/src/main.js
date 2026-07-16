import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import { router } from './router';
import './assets/styles.css';

registerSW({
  onOfflineReady() {
    // eslint-disable-next-line no-console
    console.log('App prête hors ligne');
  }
});

createApp(App).use(createPinia()).use(router).mount('#app');
