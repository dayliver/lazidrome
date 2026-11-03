import { Capacitor } from '@capacitor/core'

/** True when running inside a Capacitor native shell (not browser / PWA). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function nativePlatform(): string {
  return Capacitor.getPlatform()
}

/** Default API origin when Settings has no server URL (native requires absolute URL). */
export function defaultNativeServerUrl(): string {
  return (import.meta.env.VITE_NATIVE_SERVER_URL as string | undefined)?.replace(/\/$/, '')
    || 'https://lazidrome.hwaryong.com'
}
