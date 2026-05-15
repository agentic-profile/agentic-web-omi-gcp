import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/utils/misc";

type ReloadSpinnerProps = {
  onReload: () => void | Promise<void>;
  className?: string;
  title?: string;
  disabled?: boolean;
};

export function ReloadSpinner({
  onReload,
  className,
  title = "Reload",
  disabled = false,
}: ReloadSpinnerProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={() => void handleClick()}
      disabled={loading || disabled}
      title={title}
      className={cn(
        "text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 shrink-0",
        className
      )}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={14} />
      ) : (
        <RefreshCw size={14} />
      )}
    </Button>
  );
}
