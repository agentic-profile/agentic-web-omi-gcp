import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import { Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { LoginModal } from "@/src/components/LoginModal";
import { DIDLink } from "@/src/components/DIDLink";

type ChatResolution = {
  like?: boolean | null;
  [key: string]: unknown;
};

type AgentChatRecord = {
  agentDid: string;
  peerDid: string;
  messages?: unknown[];
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

function resolutionHint(r: Record<string, unknown> | undefined): string {
  if (!r || typeof r !== "object") return "—";
  if ("like" in r && r.like != null) {
    return r.like === true ? "Like" : r.like === false ? "Pass" : String(r.like);
  }
  const keys = Object.keys(r);
  if (keys.length === 0) return "—";
  return keys.slice(0, 3).join(", ") + (keys.length > 3 ? "…" : "");
}

function detailHref(c: AgentChatRecord): string {
  const q = new URLSearchParams({ agentDid: c.agentDid, peerDid: c.peerDid });
  return `/agent-chats/detail?${q.toString()}`;
}

export default function AgentChatsPage({
  user,
  login,
}: {
  user: User | null;
  login: () => void | Promise<void>;
}) {
  const [chats, setChats] = useState<AgentChatRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedChats = useMemo(() => {
    const copy = [...chats];
    copy.sort((a, b) => (b.updated ?? b.created ?? "").localeCompare(a.updated ?? a.created ?? ""));
    return copy;
  }, [chats]);

  const loadChats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/agent-chats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { chats?: AgentChatRecord[] };
      setChats(Array.isArray(data.chats) ? data.chats : []);
    } catch (e) {
      setChats([]);
      setError(e instanceof Error ? e.message : "Failed to load agent chats");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setError(null);
      setLoading(false);
      return;
    }
    void loadChats();
  }, [user, loadChats]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold tracking-tight truncate">Agent Chats</h1>
            <p className="text-xs md:text-sm text-zinc-400 truncate">
              Conversations between your agent and other people's agents
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => void loadChats()}
            disabled={!user || loading}
            className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Reload
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-8 py-6">
        {!user ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-6 md:p-10 text-center">
              <div className="text-zinc-300 font-semibold mb-2">Sign in to view agent chats</div>
              <div className="text-sm text-zinc-500 mb-6">
                Chats appear here when your agents message other agents.
              </div>
              <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold" onClick={() => void login()}>
                Login with Google
              </Button>
            </div>
          </Card>
        ) : error ? (
          <Card className="border-red-900/40 bg-red-950/20">
            <div className="p-6">
              <div className="font-semibold text-red-200 mb-1">Failed to load chats</div>
              <div className="text-sm text-red-200/70 break-words">{error}</div>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => void loadChats()} disabled={loading}>
                  Try again
                </Button>
              </div>
            </div>
          </Card>
        ) : loading && sortedChats.length === 0 ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-10 flex items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="animate-spin" />
              Loading chats…
            </div>
          </Card>
        ) : sortedChats.length === 0 ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <div className="p-10 text-center text-zinc-500">
              No agent chats yet. Chats appear here when your agents message other agents.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-[1fr_1fr_10rem_10rem_5rem_12rem] gap-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              <span>Your agent</span>
              <span>Peer agent</span>
              <span>Created</span>
              <span>Updated</span>
              <span className="text-right">Msgs</span>
              <span>Resolution</span>
            </div>

            {sortedChats.map((c) => (
              <Link
                key={`${c.agentDid}|${c.peerDid}`}
                to={detailHref(c)}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 rounded-xl"
              >
                <Card className="border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors">
                  <div className="p-4 md:p-5">
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-500 mb-1">Your agent</div>
                          <DIDLink did={c.agentDid} />
                        </div>
                        <div className="text-xs text-zinc-400 tabular-nums shrink-0">{c.messages?.length ?? 0} msgs</div>
                      </div>
                      <div className="pt-3 border-t border-zinc-800/70">
                        <div className="text-xs text-zinc-500 mb-1">Peer agent</div>
                        <DIDLink did={c.peerDid} />
                      </div>
                      <div className="text-xs text-zinc-500">
                        Created {formatWhen(c.created)} · Updated {formatWhen(c.updated)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        You: {resolutionHint(c.agentResolution)} · Peer: {resolutionHint(c.peerResolution)}
                      </div>
                    </div>

                    <div className="hidden md:grid grid-cols-[1fr_1fr_10rem_10rem_5rem_12rem] gap-3 items-center">
                      <div className="min-w-0">
                        <DIDLink did={c.agentDid} />
                      </div>
                      <div className="min-w-0">
                        <DIDLink did={c.peerDid} />
                      </div>
                      <div className="text-xs text-zinc-500">{formatWhen(c.created)}</div>
                      <div className="text-xs text-zinc-500">{formatWhen(c.updated)}</div>
                      <div className="text-right text-sm tabular-nums text-zinc-200">{c.messages?.length ?? 0}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        Y: {resolutionHint(c.agentResolution)} · P: {resolutionHint(c.peerResolution)}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <LoginModal open={!user} onLogin={login} onDismiss={undefined} />
    </div>
  );
}
