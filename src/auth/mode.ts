export type AuthMode = "google" | "emulator";

/**
 * Decide which auth mode to use on the client.
 *
 * Rules:
 * - Production builds ALWAYS use real Google OAuth (never emulators).
 * - Dev builds default to Google OAuth unless explicitly opted into emulator auth.
 *
 * Env:
 * - VITE_AUTH_MODE: "google" | "emulator" (optional)
 * - VITE_USE_FIREBASE_EMULATORS: "true" to opt into emulators (optional legacy flag)
 */
export function getAuthMode(): AuthMode {
  // Vite guarantees these flags.
  const isProd = Boolean((import.meta as any).env?.PROD);

  if (isProd) return "google";

  const explicit = String((import.meta as any).env?.VITE_AUTH_MODE ?? "").toLowerCase();
  if (explicit === "google") return "google";
  if (explicit === "emulator") return "emulator";

  const useEmulators = (import.meta as any).env?.VITE_USE_FIREBASE_EMULATORS === "true";
  return useEmulators ? "emulator" : "google";
}

export function usingEmulators(): boolean {
  return getAuthMode() === "emulator";
}
