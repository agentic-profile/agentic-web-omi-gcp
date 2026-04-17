import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Star } from "lucide-react";
import { createDidResolver, parseDid } from "@agentic-profile/common";
import { DIDLink } from "@/src/components/DIDLink";
import UserImage from "@/src/components/UserImage";

type AgenticProfileLike = {
  name?: unknown;
  title?: unknown;
  displayName?: unknown;
  profile?: { name?: unknown } | undefined;
  media?: { images?: Record<string, string> | string[] } | undefined;
};

function pickFirstString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function displayNameFromDoc(doc: AgenticProfileLike | null | undefined): string | undefined {
  if (!doc) return undefined;
  return (
    pickFirstString(doc.name) ??
    pickFirstString(doc.title) ??
    pickFirstString(doc.displayName) ??
    pickFirstString(doc.profile?.name)
  );
}

const didResolver = createDidResolver();

export default function AgentIdentity({
  did,
  label,
  liked,
  size = "md",
  onToggleLike,
}: {
  did: string;
  label: string;
  liked?: boolean | null;
  size?: "sm" | "md" | "lg";
  onToggleLike?: (next: boolean | null) => void | Promise<void>;
}) {
  const [doc, setDoc] = useState<AgenticProfileLike | null>(null);
  const [loading, setLoading] = useState(false);

  const baseDid = useMemo(() => parseDid(did).did ?? did, [did]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await didResolver.resolve(baseDid);
        const resolvedDoc = (res?.didDocument ?? null) as AgenticProfileLike | null;
        if (!cancelled) setDoc(resolvedDoc);
      } catch {
        if (!cancelled) setDoc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseDid]);

  const name = displayNameFromDoc(doc) ?? (loading ? "Loading…" : undefined);

  const imagePx = size === "sm" ? 32 : size === "lg" ? 56 : 40;
  const nameClass = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const labelClass = size === "sm" ? "text-[11px]" : size === "lg" ? "text-sm" : "text-xs";
  const starSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;
  const starInteractive = typeof onToggleLike === "function";

  return (
    <div className="space-y-2">
      <div className={clsx("text-zinc-500", labelClass)}>{label}</div>
      <div className="flex items-center gap-3 min-w-0">
        <UserImage
          user={{ media: (doc as any)?.media, name }}
          size={imagePx}
          className="shrink-0"
          alt={typeof name === "string" ? name : baseDid}
        />
        <div className="min-w-0 flex-1">
          {name ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className={clsx("font-semibold text-zinc-100 truncate", nameClass)}>{name}</div>
              {liked !== undefined ? (
                <button
                  type="button"
                  className={clsx(
                    "shrink-0",
                    starInteractive ? "cursor-pointer" : "cursor-default",
                    starInteractive ? "hover:opacity-90" : "",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded",
                  )}
                  onClick={() => {
                    if (!starInteractive) return;
                    const current = liked ?? null;
                    const next = current === null ? true : current === true ? false : null;
                    void onToggleLike(next);
                  }}
                  aria-label={liked === true ? "Resolution: like" : liked === false ? "Resolution: not like" : "Resolution: unset"}
                  disabled={!starInteractive}
                >
                  <Star
                    size={starSize}
                    className={clsx(liked === true ? "text-amber-500 fill-amber-500" : "text-zinc-600")}
                  />
                </button>
              ) : null}
            </div>
          ) : null}
          <DIDLink did={did} size={size} />
        </div>
      </div>
    </div>
  );
}