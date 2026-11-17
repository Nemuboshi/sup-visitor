import { mount } from 'svelte';
import './app.css';
import { initializeTheme } from './lib/theme/theme';
import App from './App.svelte';

initializeTheme();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
