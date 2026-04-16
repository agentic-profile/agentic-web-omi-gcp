import React from "react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Globe, Server } from "lucide-react";

export const DEFAULT_PUBLISHER = "https://matchwise.ai/import/agent";

interface SelectPublisherProps {
  publisherUrl: string;
  onPublisherUrlChange: (url: string) => void;
}

export function SelectPublisher({ publisherUrl, onPublisherUrlChange }: SelectPublisherProps) {
  const options = [
    {
      label: "Production",
      url: DEFAULT_PUBLISHER,
      icon: <Globe size={14} />,
    },
    {
      label: "Local Dev",
      url: "http://localhost:5173/import/agent",
      icon: <Server size={14} />,
    },
  ];

  return (
    <div className="space-y-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Globe size={14} />
          Publisher URL
        </label>
        <Input
          value={publisherUrl}
          onChange={(e) => onPublisherUrlChange(e.target.value)}
          placeholder="https://..."
          className="bg-zinc-900 border-zinc-800 text-zinc-200"
        />
      </div>
      
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Button
            key={opt.url}
            variant="outline"
            size="sm"
            onClick={() => onPublisherUrlChange(opt.url)}
            className="text-xs gap-2 border-zinc-800 hover:border-orange-500 hover:bg-orange-500/10 hover:text-orange-500 transition-all"
          >
            {opt.icon}
            {opt.label}
          </Button>
        ))}
      </div>
      
      <p className="text-[10px] text-zinc-500 italic">
        The publisher is the service that will register your agent on the Agentic Web.
      </p>
    </div>
  );
}
