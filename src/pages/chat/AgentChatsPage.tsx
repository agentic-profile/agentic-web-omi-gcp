import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { LoginModal } from "@/src/components/LoginModal";
import { DIDLink } from "@/src/components/DIDLink";
import { db } from "@/src/firebase";

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
  const [reloadNonce, setReloadNonce] = useState(0);

  const sortedChats = useMemo(() => {
    const copy = [...chats];
    copy.sort((a, b) => (b.updated ?? b.created ?? "").localeCompare(a.updated ?? a.created ?? ""));
    return copy;
  }, [chats]);

  const reload = useCallback(() => {
    if (!user) return;
    setReloadNonce((n) => n + 1);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const q = query(collection(db, "agent_chats"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data()) as AgentChatRecord[];
        setChats(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setChats([]);
        setError(err instanceof Error ? err.message : "Failed to load agent chats");
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [user, reloadNonce]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-6xl px-4 md:px-8 py-6">
        <header className="flex items-center justify-between mb-8 gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold truncate">Agent Chats</h1>
            <p className="text-sm text-zinc-500 truncate">Conversations between your agent and other people's agents</p>
          </div>
          <Button
            variant="ghost"
            onClick={reload}
            disabled={!user || loading}
            className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800 shrink-0"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Reload
          </Button>
        </header>

        {!user ? (
          <Card className="border-zinc-800 bg-zinc-900/40">
            <section className="p-6 md:p-10 text-center">
              <h2 className="text-zinc-300 font-semibold mb-2">Sign in to view agent chats</h2>
              <p className="text-sm text-zinc-500 mb-6">Chats appear here when your agents message other agents.</p>
              <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold" onClick={() => void login()}>
                Login with Google
              </Button>
            </section>
          </Card>
        ) : error ? (
          <Card className="border-red-900/40 bg-red-950/20">
            <section className="p-6">
              <h2 className="font-semibold text-red-200 mb-1">Failed to load chats</h2>
              <p className="text-sm text-red-200/70 break-words">{error}</p>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => window.location.reload()} disabled={loading}>
                  Try again
                </Button>
              </div>
            </section>
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
            <p className="p-10 text-center text-zinc-500">No agent chats yet. Chats appear here when your agents message other agents.</p>
          </Card>
        ) : (
          <section className="space-y-0" aria-label="Agent chats list">
            <div className="hidden lg:grid lg:grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,6rem)_minmax(0,6rem)_4.5rem_minmax(0,1fr)] xl:grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,7.5rem)_minmax(0,7.5rem)_4.5rem_minmax(0,1fr)] 2xl:grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,10rem)_minmax(0,10rem)_4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500 items-end">
              <span aria-hidden />
              <span className="min-w-0">Your agent</span>
              <span className="min-w-0">Peer agent</span>
              <span className="min-w-0 break-words leading-tight">Created</span>
              <span className="min-w-0 break-words leading-tight">Updated</span>
              <span className="text-right shrink-0">Msgs</span>
              <span className="min-w-0">Resolution</span>
            </div>

            <div className="divide-y-1 divide-white">
              {sortedChats.map((c) => (
                <AgentRow chat={c} />
              ))}
            </div>
          </section>
        )}
      </main>

      <LoginModal open={!user} onLogin={login} onDismiss={undefined} />
    </div>
  );
}

function AgentRow({ chat }: { chat: AgentChatRecord }) {
  return (
    <Link
      to={detailHref(chat)}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      <div className="bg-transparent hover:bg-zinc-900/40 transition-colors">
        <div className="px-1 md:px-1.5 py-1">
          <section className="lg:hidden space-y-2 py-2 px-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-2">
                <span className="shrink-0 mt-0.5 text-zinc-500 group-hover:text-white transition-colors" aria-hidden>
                  <MessageSquare size={20} />
                </span>
                <div className="text-[11px] text-zinc-500 mb-0.5">Your agent</div>
                <div className="min-w-0">
                  <DIDLink did={chat.agentDid} />
                </div>
              </div>
              <span className="text-xs text-zinc-400 tabular-nums shrink-0">{chat.messages?.length ?? 0} msgs</span>
            </div>

            <div className="border-t border-zinc-800/70 pt-2">
              <div className="text-[11px] text-zinc-500 mb-0.5">Peer agent</div>
              <DIDLink did={chat.peerDid} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-500 border-t border-zinc-800/70 pt-2">
              <p className="min-w-0 break-words">
                <span className="text-zinc-600 block uppercase tracking-wide text-[10px]">Created</span>
                {formatWhen(chat.created)}
              </p>
              <p className="min-w-0 break-words">
                <span className="text-zinc-600 block uppercase tracking-wide text-[10px]">Updated</span>
                {formatWhen(chat.updated)}
              </p>
            </div>
            <p className="text-[11px] text-zinc-500 break-words">
              You: {resolutionHint(chat.agentResolution)} · Peer: {resolutionHint(chat.peerResolution)}
            </p>
          </section>

          <div className="hidden lg:grid lg:grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,6rem)_minmax(0,6rem)_4.5rem_minmax(0,1fr)] xl:grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,7.5rem)_minmax(0,7.5rem)_4.5rem_minmax(0,1fr)] 2xl:grid-cols-[2rem_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,10rem)_minmax(0,10rem)_4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 items-center py-1">
            <div className="text-zinc-500 group-hover:text-white transition-colors flex items-center justify-center">
              <MessageSquare size={20} aria-hidden />
            </div>
            <div className="min-w-0">
              <DIDLink did={chat.agentDid} />
            </div>
            <div className="min-w-0">
              <DIDLink did={chat.peerDid} />
            </div>
            <div className="min-w-0 text-xs text-zinc-500 break-words whitespace-normal leading-snug">
              {formatWhen(chat.created)}
            </div>
            <div className="min-w-0 text-xs text-zinc-500 break-words whitespace-normal leading-snug">
              {formatWhen(chat.updated)}
            </div>
            <div className="text-right text-sm tabular-nums text-zinc-200 shrink-0">{chat.messages?.length ?? 0}</div>
            <div className="min-w-0 text-xs text-zinc-500 break-words leading-snug">
              Y: {resolutionHint(chat.agentResolution)} · P: {resolutionHint(chat.peerResolution)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
