// ============================================================================
// Short random suffix for client-generated record ids (activity entries,
// visit history, offers). Uses the Web Crypto API instead of Math.random()
// so ids aren't predictable. Available in browsers, Electron, the Android
// WebView and Node 20 (vitest).
// ============================================================================
export function randomSuffix(length = 6) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}
