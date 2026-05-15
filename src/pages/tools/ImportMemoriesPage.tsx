import React, { useCallback, useRef, useState } from "react";
import { User } from "firebase/auth";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";
import { Upload, FileJson, Loader2, CheckCircle2 } from "lucide-react";
import { getIdTokenOrLogout } from "@/src/auth/idToken";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  errors?: string[];
};

type ParsedFile = {
  name: string;
  count: number;
  payload: unknown;
};

function parseMemoriesFile(text: string): { count: number; payload: unknown } {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return { count: parsed.length, payload: { memories: parsed } };
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { memories?: unknown }).memories)) {
    const memories = (parsed as { memories: unknown[] }).memories;
    return { count: memories.length, payload: parsed };
  }
  throw new Error("File must contain a memories array (or a JSON array of memories).");
}

export default function ImportMemoriesPage({ user }: { user: User }) {
  const [dragOver, setDragOver] = useState(false);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Please upload a JSON file exported from Omi Memories.");
      return;
    }
    try {
      const text = await file.text();
      const { count, payload } = parseMemoriesFile(text);
      if (count === 0) {
        toast.error("No memories found in this file.");
        return;
      }
      setParsedFile({ name: file.name, count, payload });
      setLastResult(null);
    } catch (error) {
      console.error("Parse error:", error);
      toast.error(error instanceof Error ? error.message : "Invalid JSON file");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void readFile(file);
    },
    [readFile]
  );

  const handleImport = async () => {
    if (!parsedFile) return;
    setImporting(true);
    try {
      const token = await getIdTokenOrLogout(user);
      const response = await fetch("/api/memories/import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedFile.payload),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      const result = data as ImportResult;
      setLastResult(result);
      const upserted = result.created + result.updated;
      toast.success(
        `Imported ${upserted} ${upserted === 1 ? "memory" : "memories"}` +
          (result.skipped > 0 ? ` (${result.skipped} skipped)` : "")
      );
      setParsedFile(null);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Upload className="text-orange-500" />
          Import Memories
        </h1>
        <p className="text-zinc-400 text-sm md:text-base">
          Restore memories from a JSON file downloaded on the Omi Memories page. Existing memories with the same ID are
          updated instead of duplicated.
        </p>
      </div>

      <div
        className={`
          relative rounded-2xl border-2 border-dashed p-10 md:p-14 text-center transition-colors
          ${dragOver ? "border-orange-500 bg-orange-500/5" : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"}
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = "";
          }}
        />
        <FileJson className="mx-auto mb-4 text-zinc-600" size={40} />
        <p className="text-zinc-300 font-medium mb-1">Drag your Omi memories export here</p>
        <p className="text-sm text-zinc-500 mb-6">or</p>
        <Button
          type="button"
          variant="outline"
          className="border-zinc-700 hover:border-orange-500 hover:bg-orange-500/10 hover:text-orange-500"
          onClick={() => inputRef.current?.click()}
          disabled={importing}
        >
          Choose JSON file
        </Button>
      </div>

      {parsedFile && (
        <div className="mt-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-zinc-200">{parsedFile.name}</p>
            <p className="text-sm text-zinc-500 mt-1">
              {parsedFile.count} {parsedFile.count === 1 ? "memory" : "memories"} ready to import
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="ghost"
              onClick={() => setParsedFile(null)}
              disabled={importing}
              className="text-zinc-400"
            >
              Clear
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={importing}
              className="bg-orange-500 hover:bg-orange-600 text-black font-semibold gap-2"
            >
              {importing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="mt-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle2 size={18} />
            Import complete
          </div>
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-300">{lastResult.created}</span> created ·{" "}
            <span className="text-zinc-300">{lastResult.updated}</span> updated
            {lastResult.skipped > 0 && (
              <>
                {" "}
                · <span className="text-zinc-300">{lastResult.skipped}</span> skipped
              </>
            )}
          </p>
          {lastResult.errors && lastResult.errors.length > 0 && (
            <ul className="text-xs text-zinc-500 list-disc pl-4 space-y-1">
              {lastResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
        Export memories from More → Omi Memories using the download button, then import that file here. Memories are
        matched by ID so re-importing the same file will not create duplicates.
      </div>
    </div>
  );
}