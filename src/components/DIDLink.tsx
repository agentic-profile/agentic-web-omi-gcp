import React from "react";
import { ExternalLink } from "lucide-react";
import { webDidToUrl } from "@agentic-profile/common";
import { Button } from "@/src/components/ui/button";

interface DIDLinkProps {
  did: string;
}

export const DIDLink: React.FC<DIDLinkProps> = ({ did }) => {
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

  return (
    <div className="flex items-center gap-2 group">
      <span className="font-mono text-sm text-zinc-400 break-all bg-zinc-950/50 px-2 py-1 rounded border border-zinc-800/50 group-hover:border-orange-500/30 transition-colors">
        {did}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="h-8 w-8 text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all shrink-0"
        title="Resolve DID"
      >
        <ExternalLink size={14} />
      </Button>
    </div>
  );
};
