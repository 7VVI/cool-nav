// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';
import { useThemeStore } from '@/stores/themeStore';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

const themeStore = useThemeStore();
themeStore.init();