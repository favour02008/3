import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.classbridge.app',
  appName: 'ClassBridge',
  webDir: 'www',
  server: {
    // ClassBridge currently depends on AppDeploy's hosted authentication and API.
    // Load the live application so those platform services continue to work in the APK.
    url: 'https://classbridge-vfh1cz.v2.appdeploy.ai',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
