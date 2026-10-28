/**
 * Destination après connexion/inscription. Nécessaire car la session arrive
 * (et la garde des pages publiques redirige) avant la fin de l'appel d'inscription.
 */
type Target = { path: string; state?: unknown }
let pending: Target | null = null

export function setPostAuthTarget(target: Target | null): void {
  pending = target
}

export function peekPostAuthTarget(): Target | null {
  return pending
}
