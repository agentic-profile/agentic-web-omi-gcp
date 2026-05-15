import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { History, Calendar, MessageSquareQuote, Search, Trash2, Code, Sparkles, Download, Loader2, Pencil } from "lucide-react";
import { JsonEditorModal } from "@/src/components/JsonEditorModal";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";
import { ReloadSpinner } from "@/src/components/ReloadSpinner";
import { getIdTokenOrLogout } from "@/src/auth/idToken";

function ConfirmDeleteModal({
  open,
  title = "Delete this memory?",
  description = "Permanently remove this memory and its data. This cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirming,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming: boolean;
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 cursor-pointer" aria-hidden onClick={onDismiss} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-memory-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <h2 id="confirm-delete-memory-title" className="text-xl font-semibold text-zinc-100 mb-2">
          {title}
        </h2>
        <p className="text-sm text-zinc-400 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onDismiss} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={confirming} className="gap-2">
            {confirming ? <Loader2 className="animate-spin" size={16} /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

interface Memory {
  id: string;
  raw: any;
  summary: any;
  created: Timestamp;
  summarized: Timestamp;
  userId: string;
  // Legacy fields
  text?: string;
  timestamp?: Timestamp;
}

export default function OmiMemoriesPage({ user }: { user: User }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [jsonEditor, setJsonEditor] = useState<{ memoryId: string; field: "raw" | "summary" } | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "memories"),
      where("userId", "==", user.uid),
      orderBy("created", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Memory[];
      setMemories(docs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      // Fallback to legacy timestamp if created doesn't exist yet for some docs
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  const filteredMemories = memories.filter(m => {
    const rawStr = JSON.stringify(m.raw || m.text || "").toLowerCase();
    const summaryStr = JSON.stringify(m.summary || "").toLowerCase();
    return rawStr.includes(searchTerm.toLowerCase()) || summaryStr.includes(searchTerm.toLowerCase());
  });

  const getMemoryDate = (m: Memory) => m.created?.toDate?.() ?? m.timestamp?.toDate?.() ?? null;

  const formatMemoryDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const memoryDates = filteredMemories.map(getMemoryDate).filter((d): d is Date => d !== null);
  const memoryCount = filteredMemories.length;
  const memoryDateRange =
    memoryDates.length > 0
      ? (() => {
          const min = new Date(Math.min(...memoryDates.map((d) => d.getTime())));
          const max = new Date(Math.max(...memoryDates.map((d) => d.getTime())));
          return min.getTime() === max.getTime()
            ? formatMemoryDate(min)
            : `${formatMemoryDate(min)} – ${formatMemoryDate(max)}`;
        })()
      : null;

  const deleteTarget = deleteTargetId ? memories.find((m) => m.id === deleteTargetId) : null;
  const jsonEditorMemory = jsonEditor ? memories.find((m) => m.id === jsonEditor.memoryId) : null;

  const performDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "memories", deleteTargetId));
      toast.success("Memory deleted");
      setDeleteTargetId(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete memory");
    } finally {
      setDeleting(false);
    }
  };

  const serializeTimestamp = (value: Timestamp | undefined) =>
    value?.toDate?.()?.toISOString() ?? value;

  const getRawDisplay = (memory: Memory) => memory.raw ?? (memory.text != null ? { text: memory.text } : {});

  const handleSaveJson = async (parsed: unknown) => {
    if (!jsonEditor) return;
    const { memoryId, field } = jsonEditor;
    try {
      const ref = doc(db, "memories", memoryId);
      if (field === "raw") {
        await updateDoc(ref, { raw: parsed, text: deleteField() });
      } else {
        await updateDoc(ref, { summary: parsed, summarized: serverTimestamp() });
      }
      toast.success(field === "raw" ? "Raw data updated" : "Summary updated");
      setJsonEditor(null);
    } catch (error) {
      console.error("Update error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update memory");
      throw error;
    }
  };

  const handleDeleteSummary = async () => {
    if (!jsonEditor || jsonEditor.field !== "summary") return;
    const { memoryId } = jsonEditor;
    try {
      await updateDoc(doc(db, "memories", memoryId), {
        summary: deleteField(),
        summarized: deleteField(),
      });
      toast.success("Summary removed");
      setJsonEditor(null);
    } catch (error) {
      console.error("Delete summary error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete summary");
      throw error;
    }
  };

  const handleSummarize = async (memoryId: string) => {
    try {
      const token = await getIdTokenOrLogout(user);
      const response = await fetch(`/omi/memory/${encodeURIComponent(memoryId)}/summarize`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Failed to summarize memory");
        return;
      }
      setMemories((prev) =>
        prev.map((m) => (m.id === memoryId ? { ...m, summary: data.summary } : m))
      );
      toast.success("Summary updated");
    } catch (error) {
      console.error("Summarize error:", error);
      toast.error("Failed to summarize memory");
    }
  };

  const handleDownload = () => {
    const payload = memories.map((m) => ({
      ...m,
      created: serializeTimestamp(m.created),
      summarized: serializeTimestamp(m.summarized),
      timestamp: serializeTimestamp(m.timestamp),
    }));
    const blob = new Blob([JSON.stringify({ memories: payload }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `omi-memories-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Memories downloaded");
  };

  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto h-screen flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-8 md:mb-12 shrink-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
            <History className="text-orange-500 w-7 h-7 md:w-8 md:h-8" />
            Omi Memories
          </h1>
          <p className="text-zinc-400 text-sm md:text-base">View your raw device data and AI-generated summaries.</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input 
            placeholder="Search memories..." 
            className="pl-10 bg-zinc-900 border-zinc-800 h-10 md:h-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {!loading && memories.length > 0 && (
        <div className="flex items-center justify-between mb-4 shrink-0">
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-300 font-medium">
              {memoryCount} {memoryCount === 1 ? "memory" : "memories"}
            </span>
            {memoryDateRange && (
              <>
                <span className="mx-2 text-zinc-600">·</span>
                {memoryDateRange}
              </>
            )}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="h-9 w-9 text-zinc-400 hover:text-orange-500 hover:bg-orange-500/10"
            title="Download memories as JSON"
          >
            <Download size={18} />
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1 -mx-2 md:-mx-4 px-2 md:px-4">
        {loading ? (
          <div className="flex justify-center py-20">Loading memories...</div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
            <MessageSquareQuote className="text-zinc-700 mb-4" size={48} />
            <h3 className="text-xl font-semibold mb-2">No memories found</h3>
            <p className="text-zinc-500 max-w-xs">
              {searchTerm ? "No results match your search." : "Connect your Omi device to start capturing memories."}
            </p>
          </div>
        ) : (
          <div className="grid gap-8 pb-12">
            {filteredMemories.map((memory) => (
              <Card key={memory.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden">
                <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0 bg-zinc-900/80 border-b border-zinc-800">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                      <Calendar size={14} />
                      {memory.created?.toDate().toLocaleString() || memory.timestamp?.toDate().toLocaleString() || "Just now"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTargetId(memory.id)}
                    className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </CardHeader>
                <CardContent className="p-0 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                  {/* Raw Data Section */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        <Code size={14} className="text-blue-500" />
                        Raw JSON Data
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setJsonEditor({ memoryId: memory.id, field: "raw" })}
                        className="text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 shrink-0"
                        title="Edit raw JSON"
                      >
                        <Pencil size={14} />
                      </Button>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 max-h-[300px] overflow-auto">
                      <pre className="text-[10px] md:text-xs font-mono text-blue-400 leading-relaxed">
                        {JSON.stringify(getRawDisplay(memory), null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="p-6 space-y-4 bg-orange-500/[0.02]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        <Sparkles size={14} className="text-orange-500" />
                        AI Summary
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setJsonEditor({ memoryId: memory.id, field: "summary" })}
                          className="text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 shrink-0"
                          title={memory.summary ? "Edit summary JSON" : "Add summary JSON"}
                        >
                          <Pencil size={14} />
                        </Button>
                        <ReloadSpinner
                          title="Regenerate AI summary"
                          onReload={() => handleSummarize(memory.id)}
                        />
                      </div>
                    </div>
                    {memory.summary ? (
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 max-h-[300px] overflow-auto">
                        <pre className="text-[10px] md:text-xs font-mono text-orange-400 leading-relaxed">
                          {JSON.stringify(memory.summary, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-zinc-600 italic text-sm border border-dashed border-zinc-800 rounded-xl">
                        No summary available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>


      <JsonEditorModal
        open={jsonEditor !== null && jsonEditorMemory != null}
        title={jsonEditor?.field === "raw" ? "Edit raw JSON" : "Edit AI summary"}
        description={
          jsonEditor?.field === "raw"
            ? "Update the device payload stored for this memory."
            : "Update or remove the AI-generated summary for this memory."
        }
        initialValue={
          jsonEditor?.field === "raw"
            ? getRawDisplay(jsonEditorMemory!)
            : jsonEditorMemory?.summary ?? {}
        }
        onSave={handleSaveJson}
        onDismiss={() => setJsonEditor(null)}
        onDelete={jsonEditor?.field === "summary" && jsonEditorMemory?.summary ? handleDeleteSummary : undefined}
        deleteLabel="Remove summary"
        saveLabel="Save changes"
      />
      <ConfirmDeleteModal
        open={deleteTargetId !== null}
        description={
          deleteTarget
            ? `Permanently remove the memory from ${getMemoryDate(deleteTarget)?.toLocaleString() ?? "this date"}. This cannot be undone.`
            : "Permanently remove this memory and its data. This cannot be undone."
        }
        confirming={deleting}
        onDismiss={() => {
          if (!deleting) setDeleteTargetId(null);
        }}
        onConfirm={performDelete}
      />
    </div>
  );
}
