import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { DIDLink } from "@/src/components/DIDLink";
import { LoginModal } from "@/src/components/LoginModal";

type ChatResolution = {
  like?: boolean | null;
  [key: string]: unknown;
};

type Part =
  | { text: string; mediaType?: string; metadata?: unknown }
  | { url: string; filename?: string; mediaType?: string; metadata?: unknown }
  | { raw: string; filename?: string; mediaType?: string; metadata?: unknown }
  | { data: unknown; mediaType?: string; metadata?: unknown };

type Message = {
  role: string | number;
  parts: Part[];
  metadata?: { timestamp?: string; resolution?: ChatResolution; [key: string]: unknown };
};

type AgentChatDetail = {
  agentDid: string;
  peerDid: string;
  uid: string;
  messages: Message[];
  agentResolution?: ChatResolution;
  peerResolution?: ChatResolution;
  created?: string;
  updated?: string;
};

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function messageText(m: Message): string {
  return (m.parts ?? [])
    .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
}

export default function AgentChatsDetailRoutePage({
  user,
  login,
}: {
  user: User | null;
  login: () => void | Promise<void>;
}) {
  const [searchParams] = useSearchParams();
  const agentDid = searchParams.get("agentDid") ?? "";
  const peerDid = searchParams.get("peerDid") ?? "";

  const [chat, setChat] = useState<AgentChatDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!agentDid || !peerDid) return "Agent chat";
    return "Agent chat details";
  }, [agentDid, peerDid]);

  const load = useCallback(async () => {
    if (!user || !agentDid || !peerDid) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const q = new URLSearchParams({ agentDid, peerDid });
      const res = await fetch(`/api/agent-chats/detail?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { chat?: AgentChatDetail | null };
      setChat(data.chat ?? null);
    } catch (e) {
      setChat(null);
      setError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }, [agentDid, peerDid, user]);

  const performDelete = useCallback(async () => {
    if (!user || !agentDid || !peerDid) return;
    setDeleting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const q = new URLSearchParams({ agentDid, peerDid });
      const res = await fetch(`/api/agent-chats?${q.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }
      window.location.assign("/agent-chats");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete chat");
    } finally {
      setDeleting(false);
    }
  }, [agentDid, peerDid, user]);

  useEffect(() => {
    if (!user) {
      setChat(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (agentDid && peerDid) void load();
  }, [user, agentDid, peerDid, load]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold tracking-tight truncate">{title}</h1>
            <p className="text-xs md:text-sm text-zinc-400 truncate">Agent-to-agent (A2A) messages</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => void load()}
              disabled={!user || loading || !agentDid || !peerDid}
              className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Reload
            </Button>
            <Button
              variant="ghost"
              onClick={() => void performDelete()}
              disabled={!user || deleting || !agentDid || !peerDid}
              className="gap-2 text-red-200 hover:text-red-100 hover:bg-red-950/40"
              title="Delete chat"
            >
              {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Delete
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-6 space-y-4">
        <div>
          <Link to="/agent-chats" className="text-sm text-zinc-400 hover:text-zinc-100">
            ← All chats
          </Link>
        </div>

        {!user ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-8 text-center">
              <div className="text-zinc-300 font-semibold mb-2">Sign in to view this chat</div>
              <div className="text-sm text-zinc-500 mb-6">Please log in with Google to continue.</div>
              <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold" onClick={() => void login()}>
                Login with Google
              </Button>
            </div>
          </Card>
        ) : !agentDid || !peerDid ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-8 text-zinc-400">
              Missing agent or peer. Open a chat from the agent chats list.
            </div>
          </Card>
        ) : error ? (
          <Card className="border-red-900/40 bg-red-950/20">
            <div className="p-6">
              <div className="font-semibold text-red-200 mb-1">Error</div>
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
            <div className="p-8 text-zinc-400">Chat not found or you do not have access.</div>
          </Card>
        ) : (
          <>
            <Card className="border-zinc-800 bg-zinc-900/40">
              <div className="p-5 space-y-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Your agent</div>
                    <DIDLink did={chat.agentDid} />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Peer agent</div>
                    <DIDLink did={chat.peerDid} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 pt-3 border-t border-zinc-800/70 text-sm text-zinc-300">
                  <div>
                    <span className="text-zinc-500">Created:</span> {formatWhen(chat.created)}
                  </div>
                  <div>
                    <span className="text-zinc-500">Updated:</span> {formatWhen(chat.updated)}
                  </div>
                  <div>
                    <span className="text-zinc-500">Messages:</span> {chat.messages?.length ?? 0}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/40">
              <div className="p-5">
                <div className="font-semibold mb-4">Messages</div>
                {(chat.messages ?? []).length === 0 ? (
                  <div className="text-zinc-500">No messages recorded.</div>
                ) : (
                  <ul className="space-y-3">
                    {(chat.messages ?? []).map((m, i) => {
                      const body = messageText(m);
                      const ts = typeof m.metadata?.timestamp === "string" ? m.metadata.timestamp : undefined;
                      return (
                        <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                          <div className="text-xs text-zinc-500 mb-2">
                            Role: <span className="text-zinc-300">{String(m.role)}</span>
                            {ts ? <span className="ml-3">{formatWhen(ts)}</span> : null}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-sm text-zinc-100">
                            {body || "(empty message)"}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </>
        )}
      </main>

      <LoginModal open={!user} onLogin={login} onDismiss={undefined} />
    </div>
  );
}

