import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { usingEmulators } from "./mode";

type FirebaseAuthErrorLike = {
  code?: string;
  message?: string;
};

function shouldForceLogout(err: unknown): boolean {
  const code = (err as FirebaseAuthErrorLike | null)?.code ?? "";
  if (typeof code === "string" && code.startsWith("auth/")) {
    // If we're using the emulator and it's down, the UI gets stuck "logged in".
    // Treat network failure as fatal in that scenario.
    if (code === "auth/network-request-failed") {
      return usingEmulators();
    }
    return true;
  }

  // Defensive fallback: if the refresh token is rejected, Firebase often surfaces it via message text.
  const msg = (err as FirebaseAuthErrorLike | null)?.message ?? "";
  if (typeof msg === "string") {
    const upper = msg.toUpperCase();
    if (upper.includes("INVALID_REFRESH_TOKEN")) return true;
    if (upper.includes("TOKEN_EXPIRED")) return true;
    if (upper.includes("INVALID_GRANT")) return true;
  }

  return false;
}

/**
 * Returns an ID token for API calls. If Firebase can't refresh the underlying OAuth session,
 * we sign the user out so the UI doesn't get stuck in an invalid "logged in" state.
 */
export async function getIdTokenOrLogout(user: User, opts?: { forceRefresh?: boolean }): Promise<string> {
  try {
    return await user.getIdToken(Boolean(opts?.forceRefresh));
  } catch (err) {
    if (shouldForceLogout(err)) {
      try {
        await signOut(auth);
      } catch {
        // Best effort; auth state listener will still reconcile if signOut fails.
      }
    }
    throw err;
  }
}

