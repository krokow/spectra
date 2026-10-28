/** Retour haptique léger, uniquement si supporté et si l'utilisateur ne réduit pas les animations. */
export function haptic(pattern: number | number[] = 10): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate(pattern)
}
