import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hwaryong.lazidrome',
  appName: 'Lazidrome',
  webDir: 'dist',
  server: {
    // Capacitor 5+: Android WebView origin is https://localhost
    androidScheme: 'https',
    allowNavigation: ['lazidrome.hwaryong.com'],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
  },
}

export default config
