let opener: HTMLElement | null = null;

/** Remembers which button opened the app, so focus can go back to it on close. */
export function rememberOpener(element: HTMLElement | null): void {
  opener = element;
}

/** Focuses the opener again, or the dock's "Open app" button when it is gone. */
export function restoreOpenerFocus(): void {
  const target = opener?.isConnected ? opener : document.getElementById('open-app');
  opener = null;
  target?.focus({ preventScroll: true });
}
