import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "../firebase";
import { User as UserIcon, Terminal, FileEdit, ChevronRight, History, MessageSquare, Settings, Bot, Users } from "lucide-react";

type AccountData = {
  role?: string;
};

type Option = {
  label: string;
  icon: React.ReactNode;
  path: string;
  hidden?: boolean;
};

type OptionsGroupProps = {
  title: string;
  options: Option[];
  onNavigate: (path: string) => void;
};

const OptionsGroup: React.FC<OptionsGroupProps> = ({ title, options, onNavigate }) => {
  const visible = options.filter((o) => !o.hidden);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold tracking-wider text-zinc-500 uppercase px-2">{title}</div>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
        {visible.map((opt) => (
          <button
            key={opt.path}
            onClick={() => onNavigate(opt.path)}
            className="w-full flex items-center justify-between p-6 hover:bg-zinc-800 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400 group-hover:text-orange-500 transition-colors">
                {opt.icon}
              </div>
              <span className="font-medium text-zinc-100">{opt.label}</span>
            </div>
            <ChevronRight size={20} className="text-zinc-600" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default function MorePage({ user }: { user: User }) {
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountData | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "accounts", user.uid), (docSnap) => {
      if (docSnap.exists()) setAccount(docSnap.data() as AccountData);
    });
    return () => unsub();
  }, [user.uid]);

  const isAdmin = account?.role === "admin";

  const groups = useMemo(
    () => [
      {
        title: "Chats & memories",
        options: [
          { label: "Omi Memories", icon: <History size={20} />, path: "/history" },
          { label: "Agent Chats", icon: <Bot size={20} />, path: "/agent-chats" },
          { label: "Reflection Chat", icon: <MessageSquare size={20} />, path: "/reflection-chat" },
        ] satisfies Option[],
      },
      {
        title: "Account & settings",
        options: [
          { label: "My Account", icon: <UserIcon size={20} />, path: "/account" },
          { label: "Edit Prompts & Introduction", icon: <FileEdit size={20} />, path: "/edit-prompts" },
          { label: "Settings", icon: <Settings size={20} />, path: "/settings" },
        ] satisfies Option[],
      },
      {
        title: "Tools",
        options: [
          { label: "Test", icon: <Terminal size={20} />, path: "/test" },
          { label: "Manage Users", icon: <Users size={20} />, path: "/manage-users", hidden: !isAdmin },
        ] satisfies Option[],
      },
    ],
    [isAdmin]
  );

  return (
    <div className="p-4 md:p-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">More</h1>
      <div className="space-y-8">
        {groups.map((g) => (
          <OptionsGroup key={g.title} title={g.title} options={g.options} onNavigate={(p) => navigate(p)} />
        ))}
      </div>
    </div>
  );
}
