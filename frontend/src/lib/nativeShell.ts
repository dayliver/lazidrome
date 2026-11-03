import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { isNativeApp } from '@/lib/nativePlatform'

/** Status bar + back-button wiring for the Capacitor Android shell. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' })
  } catch {
    // StatusBar is unavailable on some WebView builds — ignore.
  }

  try {
    await SplashScreen.hide()
  } catch {
    // optional
  }

  await CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
      return
    }
    void CapApp.exitApp()
  })
}
