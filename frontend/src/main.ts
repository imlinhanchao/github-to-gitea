import './style.css';
import { createApp } from 'vue';
import { addCollection } from '@iconify/vue';
import lucideIcons from '@iconify-json/lucide/icons.json';
import App from './App.vue';
import router from './router';

addCollection(lucideIcons as Parameters<typeof addCollection>[0]);

const app = createApp(App);
app.use(router);

router.isReady().then(() => {
  app.mount('#app');
});
