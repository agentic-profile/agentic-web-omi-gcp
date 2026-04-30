import React from "react";
import { ExternalLink } from "lucide-react";
import { webDidToUrl } from "@agentic-profile/common";

export type DIDLinkSize = "sm" | "md" | "lg";

interface DIDLinkProps {
  did: string;
  size?: DIDLinkSize;
}

export const DIDLink: React.FC<DIDLinkProps> = ({ did, size = "md" }) => {
  const handleOpen = () => {
    try {
      const url = webDidToUrl(did);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Failed to resolve DID to URL:", error);
    }
  };

  const pillClass =
    size === "sm"
      ? "text-xs px-2 py-0.5"
      : size === "lg"
        ? "text-base px-3 py-1.5"
        : "text-sm px-2 py-1";

  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={[
        "group inline-block text-left max-w-full",
        "font-mono text-zinc-400 bg-zinc-950/50 rounded border border-zinc-800/50",
        "hover:border-orange-500/30 hover:bg-zinc-950/70 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60",
        pillClass,
      ].join(" ")}
      title="Resolve DID"
    >
      <span className="break-all">
        {did}
        <ExternalLink
          size={iconSize}
          className="inline-block align-[-2px] ml-1 text-zinc-500 group-hover:text-orange-500 transition-colors"
        />
      </span>
    </button>
  );
};
