import { i18n } from './index'

/** Pinia store·composable 등 setup 밖에서 사용 */
export function t(key, params) {
  return i18n.global.t(key, params ?? {})
}
