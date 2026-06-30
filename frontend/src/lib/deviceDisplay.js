import { Smartphone, Tablet, Monitor } from 'lucide-vue-next'

export function deviceIconForName(name) {
  const n = String(name || '').toLowerCase()
  if (n.includes('iphone') || n.includes('android')) return Smartphone
  if (n.includes('ipad')) return Tablet
  return Monitor
}

export function sortConnectedDevices(devices, localDeviceId) {
  const list = [...(devices || [])]
  return list.sort((a, b) => {
    if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1
    if (a.deviceId === localDeviceId) return -1
    if (b.deviceId === localDeviceId) return 1
    return String(a.deviceName || '').localeCompare(String(b.deviceName || ''))
  })
}
