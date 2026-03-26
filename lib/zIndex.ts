/**
 * Z-index centralisé — source de vérité unique
 *
 * Règle : plus le chiffre est élevé, plus l'élément passe devant.
 * Ne JAMAIS utiliser de z-index en dur dans les composants.
 * Importer depuis ce fichier.
 *
 * Échelle :
 *   10  Navigation fixe (header, bottom nav)
 *   20  Panels onboarding
 *   30  FAB (bouton +)
 *   40  Popovers, dropdowns
 *   50  Modales, drawers, overlays
 *   55  CoachMark overlay
 *   56  CoachMark tooltip
 *   60  Level-up, popups spéciaux
 *   70  Écrans fullscreen (messages)
 *   80  Banners système (install, push)
 *   90  Toasts
 *   95  Bug report button
 *  100  Bug report modal
 */

export const Z = {
  /** Header et BottomNav */
  NAV: 10,
  /** Panels d'onboarding (full-screen) */
  ONBOARDING: 20,
  /** FAB (bouton + flottant) */
  FAB: 30,
  /** Popovers et dropdowns */
  POPOVER: 40,
  /** Modales, drawers, overlays standard */
  MODAL: 50,
  /** CoachMark overlay (fond translucide) */
  COACH_OVERLAY: 55,
  /** CoachMark tooltip (bulle) */
  COACH_TOOLTIP: 56,
  /** Level-up animation, TeamMessage popup */
  CELEBRATION: 60,
  /** Messages fullscreen */
  FULLSCREEN: 70,
  /** Banners système (install prompt, push registration) */
  BANNER: 80,
  /** Toast notifications */
  TOAST: 90,
  /** Bug report button */
  BUG_BUTTON: 95,
  /** Bug report modal */
  BUG_MODAL: 100,
} as const
