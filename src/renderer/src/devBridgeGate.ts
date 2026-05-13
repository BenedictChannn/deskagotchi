/** Browser-only development bridge gating helpers. */

const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Decide whether to install the browser-only development bridge.
 *
 * Args:
 *   hostname: Current renderer hostname.
 *   hasNativeBridge: Whether preload already exposed the native API.
 *   userAgent: Renderer user agent used to distinguish Electron from a browser.
 *
 * Returns:
 *   True only for plain localhost browser previews without a native bridge.
 */
export function shouldInstallDevDeskagotchiApi(
  hostname: string,
  hasNativeBridge: boolean,
  userAgent: string
): boolean {
  return (
    !hasNativeBridge &&
    DEV_HOSTS.has(hostname) &&
    !userAgent.includes("Electron/")
  );
}
