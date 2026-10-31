import type { Location } from 'react-router';

/** Router state while the app is open (see SiteShell). */
export interface AppLocationState {
  /** The landing page the app was opened from: it stays mounted underneath. */
  backgroundLocation?: Location;
  /** Opened from "Hold to speak": focus the mic (never starts recording by itself). */
  focusMic?: boolean;
}

/** Shared by the dock's "Open app" pill and the desktop phone frame: the pill grows into it. */
export const APP_SURFACE_ID = 'app-surface';

export function isAppPath(pathname: string): boolean {
  return pathname === '/app' || pathname.startsWith('/app/');
}

/** State to carry along when moving between app screens (keeps the landing underneath). */
export function carryAppState(state: unknown): AppLocationState {
  return { backgroundLocation: (state as AppLocationState | null)?.backgroundLocation };
}
