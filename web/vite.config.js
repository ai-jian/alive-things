import { defineConfig } from 'vite';
import { injectIWER } from '@iwsdk/vite-plugin-iwer';

// BASE_PATH is set by the GitHub Pages workflow (/alive-things/). Locally it is '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: { host: true, port: 8081 },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 7000 },
  plugins: [
    // Desktop WebXR emulation (IWER): an emulated Quest 3 with hands and a synthetic living room, so the
    // deployed page is also the emulator. Real headset browsers (OculusBrowser UA) are left alone.
    injectIWER({ device: 'metaQuest3', sem: { defaultScene: 'living_room' }, activation: 'always', injectOnBuild: true, verbose: false }),
  ],
});
