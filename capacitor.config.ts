import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cooking.journal',
  appName: 'Cooking Journal',
  webDir: 'out',
  server: {
    // For development: point to your local Next.js server
    // Replace with your computer's local IP (run: ipconfig or ifconfig)
    url: 'http://192.168.68.104:3000',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
