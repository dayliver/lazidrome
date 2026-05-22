/** 초 → "N시간 M분" / "M분" (0이면 "0분") */
export function formatListenSeconds(seconds) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  if (sec === 0) return '0분';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}
