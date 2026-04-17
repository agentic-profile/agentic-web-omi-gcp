import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { User } from "firebase/auth";
import { deleteDoc, doc, onSnapshot } from "firebase/firestore";
import clsx from "clsx";
import { Loader2, Star, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { LoginModal } from "@/src/components/LoginModal";
import AgentIdentity from "@/src/components/AgentIdentity";
import { db } from "@/src/firebase";
import { createDidResolver, parseDid } from "@agentic-profile/common";

type ChatResolution = {
  like?: boolean | null;
  [key: string]: unknown;
};

type TextPart = { text: string; mediaType?: "text/plain"; metadata?: unknown };
type UrlPart = { url: string; filename?: string; mediaType?: string; metadata?: unknown };
type RawPart = { raw: string; filename?: string; mediaType?: string; metadata?: unknown };
type DataPart = { data: unknown; mediaType?: "application/json"; metadata?: unknown };
type Part = TextPart | UrlPart | RawPart | DataPart;

type AgentChatMessage = {
  role: string | number;
  parts?: Part[];
  metadata?: {
    timestamp?: string;
    resolution?: ChatResolution;
    [key: string]: unknown;
  };
};

type AgentChatRecord = {
  uid?: string;
  agentDid: string;
  peerDid: string;
  messages?: AgentChatMessage[];
  agentResolution?: ChatResolution;
  peerResolution?: ChatResolution;
  created?: string;
  updated?: string;
};



function ConfirmDeleteModal({
  open,
  title = "Delete this chat?",
  description = "Permanently remove this conversation and its messages. This cannot be undone.",
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
        aria-labelledby="confirm-delete-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
      >
        <h2 id="confirm-delete-title" className="text-xl font-semibold text-zinc-100 mb-2">
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

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatMessageTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function partToText(p: Part): string {
  if ("text" in p && typeof p.text === "string") return p.text;
  if ("raw" in p && typeof p.raw === "string") return p.raw;
  if ("url" in p && typeof p.url === "string") {
    const label = typeof p.filename === "string" && p.filename ? p.filename : "link";
    return `${label}: ${p.url}`;
  }
  if ("data" in p) {
    try {
      return JSON.stringify(p.data, null, 2);
    } catch {
      return String(p.data);
    }
  }
  return "";
}

function messageBody(m: AgentChatMessage): string {
  return (m.parts ?? [])
    .map(partToText)
    .filter(Boolean)
    .join("\n");
}

function isRoleUser(role: string | number): boolean {
  const r = String(role);
  return r === "ROLE_USER" || r === "1";
}

function isRoleAgent(role: string | number): boolean {
  const r = String(role);
  return r === "ROLE_AGENT" || r === "2";
}

function messageTimestamp(m: AgentChatMessage): string | undefined {
  const raw = m.metadata?.timestamp;
  return typeof raw === "string" ? raw : undefined;
}

type AgenticProfileLike = {
  name?: unknown;
  title?: unknown;
  displayName?: unknown;
  profile?: { name?: unknown } | undefined;
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

export default function AgentChatsDetailPage({
  user,
  login,
}: {
  user: User | null;
  login: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentDid = searchParams.get("agentDid") ?? "";
  const peerDid = searchParams.get("peerDid") ?? "";

  const [chat, setChat] = useState<AgentChatRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<"continue" | "restart" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [peerDisplayName, setPeerDisplayName] = useState<string | null>(null);
  const [peerLikeOverride, setPeerLikeOverride] = useState<boolean | null | undefined>(undefined);

  const docId = useMemo(() => {
    if (!agentDid || !peerDid) return "";
    return `${agentDid}^${peerDid}`;
  }, [agentDid, peerDid]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  useEffect(() => {
    if (!user || !docId) {
      setChat(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const ref = doc(db, "agent_chats", docId);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setChat(null);
          setLoading(false);
          return;
        }
        setChat(snap.data() as AgentChatRecord);
        setLoading(false);
        requestAnimationFrame(() => scrollToBottom("auto"));
      },
      (err) => {
        console.error("Firestore error:", err);
        setChat(null);
        setError(err instanceof Error ? err.message : "Failed to load agent chat");
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [docId, scrollToBottom, user]);

  useEffect(() => {
    let cancelled = false;
    setPeerDisplayName(null);
    if (!peerDid) return;

    const baseDid = parseDid(peerDid).did ?? peerDid;

    void (async () => {
      try {
        const res = await didResolver.resolve(baseDid);
        const doc = (res?.didDocument ?? null) as AgenticProfileLike | null;
        const name = displayNameFromDoc(doc) ?? null;
        if (!cancelled) setPeerDisplayName(name);
      } catch {
        if (!cancelled) setPeerDisplayName(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peerDid]);

  const agentLiked = useMemo(() => chat?.agentResolution?.like === true, [chat?.agentResolution]);
  const peerLiked = useMemo(() => chat?.peerResolution?.like === true, [chat?.peerResolution]);
  const peerLikeValue = (peerLikeOverride !== undefined ? peerLikeOverride : (chat?.peerResolution?.like ?? null)) as
    | boolean
    | null;

  useEffect(() => {
    if (peerLikeOverride === undefined) return;
    const chatLike = (chat?.peerResolution?.like ?? null) as boolean | null;
    if (chatLike === peerLikeOverride) setPeerLikeOverride(undefined);
  }, [peerLikeOverride, chat?.peerResolution]);

  const performPeerLike = useCallback(
    async (next: boolean | null) => {
      if (!user || !agentDid || !peerDid) return;
      setPeerLikeOverride(next);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/agent-chats/like", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agentDid, peerDid, like: next }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to update like");
        }
      } catch (e) {
        console.error("Failed to update like:", e);
        setPeerLikeOverride(undefined);
        setError(e instanceof Error ? e.message : "Failed to update like");
      }
    },
    [agentDid, peerDid, user],
  );

  const performContinue = useCallback(
    async (options?: { rewind?: boolean; scrollToBottom?: boolean }) => {
      if (!user || !agentDid || !peerDid) return;
      const action: "continue" | "restart" = options?.rewind ? "restart" : "continue";
      setContinuing(action);
      setError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/agent-chats/continue", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentDid,
            peerDid,
            rewind: Boolean(options?.rewind),
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to continue chat");
        }
        if (options?.scrollToBottom ?? true) {
          requestAnimationFrame(() => scrollToBottom("smooth"));
        }
      } catch (e) {
        console.error("Failed to continue agent chat:", e);
        setError(e instanceof Error ? e.message : "Failed to continue chat");
      } finally {
        setContinuing(null);
      }
    },
    [agentDid, peerDid, scrollToBottom, user],
  );

  const performDelete = useCallback(async () => {
    if (!user || !docId || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "agent_chats", docId));
      setDeleteModalOpen(false);
      navigate("/agent-chats");
    } catch (e) {
      console.error("Failed to delete agent chat:", e);
      setError(e instanceof Error ? e.message : "Failed to delete agent chat");
    } finally {
      setDeleting(false);
    }
  }, [deleting, docId, navigate, user]);

  const busy = loading || deleting || continuing !== null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-6 space-y-4">
        <header className="flex items-start justify-between mb-8 gap-4">
          <div className="min-w-0">
            <Link
              to="/agent-chats"
              className="inline-block text-sm text-zinc-400 hover:text-zinc-100 hover:underline underline-offset-4 mb-2"
            >
              ← Back to Agent Chats
            </Link>
            <h1 className="text-3xl font-bold truncate">Chat Detail</h1>
            <p className="text-sm text-zinc-500 truncate mt-2">Agent-to-agent (A2A) messages</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              onClick={() => void performContinue({ rewind: true, scrollToBottom: false })}
              disabled={!user || !docId || busy}
              className="gap-2"
              title="Restart chat"
            >
              {continuing === "restart" ? <Loader2 className="animate-spin" size={16} /> : null}
              Restart
            </Button>
            <Button
              onClick={() => void performContinue({ scrollToBottom: false })}
              disabled={!user || !docId || busy}
              className="gap-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
              title="Continue chat"
            >
              {continuing === "continue" ? <Loader2 className="animate-spin" size={16} /> : null}
              Continue
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteModalOpen(true)}
              disabled={!user || !docId || busy}
              className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
              title="Delete chat"
            >
              <Trash2 size={16} />
              Delete
            </Button>
          </div>
        </header>

        <ConfirmDeleteModal
          open={deleteModalOpen}
          confirming={deleting}
          onDismiss={() => {
            if (!deleting) setDeleteModalOpen(false);
          }}
          onConfirm={performDelete}
        />

        {!agentDid || !peerDid ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-6 md:p-10 text-center">
              <div className="text-zinc-300 font-semibold mb-2">Missing agent or peer</div>
              <div className="text-sm text-zinc-500 mb-6">Open a chat from the agent chats list.</div>
              <Link to="/agent-chats">
                <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold">Back to chats</Button>
              </Link>
            </div>
          </Card>
        ) : !user ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-6 md:p-10 text-center">
              <div className="text-zinc-300 font-semibold mb-2">Sign in to view this chat</div>
              <div className="text-sm text-zinc-500 mb-6">This chat is only visible to its owner.</div>
              <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold" onClick={() => void login()}>
                Login with Google
              </Button>
            </div>
          </Card>
        ) : error ? (
          <Card className="border-red-900/40 bg-red-950/20">
            <div className="p-6">
              <div className="font-semibold text-red-200 mb-1">Failed to load chat</div>
              <div className="text-sm text-red-200/70 break-words">{error}</div>
            </div>
          </Card>
        ) : loading && !chat ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-10 flex items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="animate-spin" />
              Loading chat…
            </div>
          </Card>
        ) : !chat ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-10 text-center text-zinc-500">Chat not found (or you don't have access).</div>
          </Card>
        ) : (
          <>
            <Card className="border-zinc-800 bg-zinc-900/40">
              <div className="p-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <AgentIdentity did={chat.agentDid} label="Your agent" liked={agentLiked} size="lg" />
                  <AgentIdentity did={chat.peerDid} label="Peer agent" liked={peerLikeValue} size="lg" onToggleLike={performPeerLike} />
                </div>

                <div className="pt-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div className="text-zinc-400">
                    <span className="text-zinc-500">Created:</span> {formatWhen(chat.created)}
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-zinc-500">Updated:</span> {formatWhen(chat.updated)}
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-zinc-500">Messages:</span> {chat.messages?.length ?? 0}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40">
              <div className="p-5 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Messages</h2>
                {(chat.messages ?? []).length === 0 ? (
                  <div className="text-zinc-500">No messages recorded.</div>
                ) : (
                  <ul className="space-y-4 min-w-0">
                    {(chat.messages ?? []).map((m, i) => {
                      const userMsg = isRoleUser(m.role);
                      const agentMsg = isRoleAgent(m.role);
                      const alignRight = agentMsg;
                      const label =
                        !userMsg && !agentMsg ? `Role ${String(m.role)}` : userMsg ? (peerDisplayName ?? "Peer") : "You";
                      const body = messageBody(m);
                      const ts = formatMessageTime(messageTimestamp(m));
                      return (
                        <li key={i} className={clsx("flex w-full min-w-0", alignRight ? "justify-end" : "justify-start")}>
                          <div className="w-4/5 max-w-[80%] min-w-0 flex flex-col gap-1">
                            <div className={clsx("text-xs text-gray-600", alignRight ? "text-right" : "text-left")}>
                              {label}
                            </div>
                            <div
                              className={clsx(
                                "rounded-xl px-4 py-3 text-[15px] leading-6 border border-gray-200 text-black",
                                userMsg
                                  ? "bg-sky-100"
                                  : agentMsg
                                    ? "bg-gray-100"
                                    : "bg-gray-50",
                              )}
                            >
                              {body ? (
                                <div className="break-words">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                    components={{
                                      a: ({ node, ...props }) => (
                                        <a
                                          {...props}
                                          className="text-blue-700 underline underline-offset-2 hover:text-blue-800"
                                          target="_blank"
                                          rel="noreferrer"
                                        />
                                      ),
                                      code: ({ node, className, children, ...props }) => {
                                        const inline = !className;
                                        return inline ? (
                                          <code {...props} className="px-1 py-0.5 rounded bg-gray-200 text-black font-mono text-[0.95em]">
                                            {children}
                                          </code>
                                        ) : (
                                          <code {...props} className={clsx("text-black font-mono", className)}>
                                            {children}
                                          </code>
                                        );
                                      },
                                      pre: ({ node, children, ...props }) => (
                                        <pre
                                          {...props}
                                          className="mt-2 p-3 rounded-lg bg-white border border-gray-200 overflow-x-auto text-sm"
                                        >
                                          {children}
                                        </pre>
                                      ),
                                      p: ({ node, children, ...props }) => (
                                        <p {...props} className="whitespace-pre-wrap break-words [&:not(:first-child)]:mt-2">
                                          {children}
                                        </p>
                                      ),
                                      ul: ({ node, children, ...props }) => (
                                        <ul {...props} className="list-disc pl-5 [&:not(:first-child)]:mt-2">
                                          {children}
                                        </ul>
                                      ),
                                      ol: ({ node, children, ...props }) => (
                                        <ol {...props} className="list-decimal pl-5 [&:not(:first-child)]:mt-2">
                                          {children}
                                        </ol>
                                      ),
                                      li: ({ node, children, ...props }) => (
                                        <li {...props} className="mt-1">
                                          {children}
                                        </li>
                                      ),
                                      blockquote: ({ node, children, ...props }) => (
                                        <blockquote {...props} className="border-l-4 border-gray-300 pl-3 text-gray-800 [&:not(:first-child)]:mt-2">
                                          {children}
                                        </blockquote>
                                      ),
                                      h1: ({ node, children, ...props }) => (
                                        <h3 {...props} className="text-base font-semibold mt-3">
                                          {children}
                                        </h3>
                                      ),
                                      h2: ({ node, children, ...props }) => (
                                        <h3 {...props} className="text-base font-semibold mt-3">
                                          {children}
                                        </h3>
                                      ),
                                      h3: ({ node, children, ...props }) => (
                                        <h3 {...props} className="text-base font-semibold mt-3">
                                          {children}
                                        </h3>
                                      ),
                                    }}
                                  >
                                    {body}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <div className="text-gray-600">(empty message)</div>
                              )}
                              {ts ? (
                                <div
                                  className={clsx(
                                    "text-[11px] leading-tight text-gray-600 mt-2",
                                    alignRight ? "text-right" : "text-left",
                                  )}
                                >
                                  {ts}
                                </div>
                              ) : null}
                            </div>
                            {m.metadata && Object.keys(m.metadata).length > 0 ? (
                              <details className={clsx("text-xs text-zinc-500", alignRight ? "text-right" : "text-left")}>
                                <summary className="cursor-pointer select-none inline-block">Metadata</summary>
                                <pre className="mt-1 p-2 bg-zinc-950/60 rounded border border-zinc-800 overflow-x-auto text-left">
                                  {JSON.stringify(m.metadata, null, 2)}
                                </pre>
                              </details>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div ref={bottomRef} />
                <div className="flex justify-end pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void performContinue({ rewind: true, scrollToBottom: true })}
                      disabled={!user || !docId || busy}
                      className="gap-2"
                    >
                      {continuing === "restart" ? <Loader2 className="animate-spin" size={16} /> : null}
                      Restart
                    </Button>
                    <Button
                      onClick={() => void performContinue({ scrollToBottom: true })}
                      disabled={!user || !docId || busy}
                      className="gap-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                    >
                      {continuing === "continue" ? <Loader2 className="animate-spin" size={16} /> : null}
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>

      <LoginModal open={!user} onLogin={login} onDismiss={undefined} />
    </div>
  );
}
