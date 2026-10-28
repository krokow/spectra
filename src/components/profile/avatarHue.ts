/** Teinte de départ dérivée de la graine : chaque avatar a sa place dans le spectre. */
export function avatarHue(seed: string): number {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 360
}
