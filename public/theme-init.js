// Thème appliqué avant le rendu pour éviter le flash (sombre par défaut).
// Fichier externe : la CSP interdit les scripts inline.
try {
  var t = localStorage.getItem('spectra-theme')
  if (t === 'light') document.documentElement.classList.remove('dark')
} catch (e) {
  /* stockage indisponible : on reste en sombre */
}
