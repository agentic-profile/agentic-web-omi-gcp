import React from "react";
import { ExternalLink } from "lucide-react";
import { webDidToUrl } from "@agentic-profile/common";
import { Button } from "@/src/components/ui/button";

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

  const buttonClass = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-9 w-9" : "h-8 w-8";
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

  return (
    <div className="flex items-center gap-2 group">
      <span
        className={[
          "font-mono text-zinc-400 break-all bg-zinc-950/50 rounded border border-zinc-800/50 group-hover:border-orange-500/30 transition-colors",
          pillClass,
        ].join(" ")}
      >
        {did}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className={[
          buttonClass,
          "text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all shrink-0",
        ].join(" ")}
        title="Resolve DID"
      >
        <ExternalLink size={iconSize} />
      </Button>
    </div>
  );
};
