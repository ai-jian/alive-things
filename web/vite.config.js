import { defineConfig } from 'vite';
import { injectIWER } from '@iwsdk/vite-plugin-iwer';

// BASE_PATH is set by the GitHub Pages workflow (/alive-things/). Locally it is '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: { host: true, port: 8081 },
  build: { target: 'es2022', sourcemap: false },
  plugins: [
    // Desktop WebXR emulation (IWER) with a synthetic living room so plane detection has something to find.
    injectIWER({ device: 'metaQuest3', sem: { defaultScene: 'living_room' }, activation: 'localhost', verbose: false }),
  ],
});
