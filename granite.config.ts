import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'saju-500',
  brand: {
    displayName: '사주500',
    primaryColor: '#C9A96E',
    icon: 'https://appintoss-saju.web.app/logo.png',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [
    { name: 'clipboard', access: 'read' },
    { name: 'clipboard', access: 'write' },
  ],
});
