import React from "react";
import { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, Terminal, FileEdit, ChevronRight, History, MessageSquare, Settings } from "lucide-react";
import { LoginModal } from "../components/LoginModal";

export default function ManagePage({ user, login }: { user: User | null; login: () => void }) {
  const navigate = useNavigate();
  const needsLogin = !user;

  const options = [
    { label: "My Account", icon: <UserIcon size={20} />, path: "/account" },
    { label: "Omi Memories", icon: <History size={20} />, path: "/history" },
    { label: "Reflection Chat", icon: <MessageSquare size={20} />, path: "/chat" },
    { label: "Edit Prompts & Introduction", icon: <FileEdit size={20} />, path: "/edit-prompts" },
    { label: "Settings", icon: <Settings size={20} />, path: "/settings" },
    { label: "Test", icon: <Terminal size={20} />, path: "/test" },
  ];

  return (
    <>
      <div
        className={
          needsLogin
            ? "p-4 md:p-12 max-w-2xl mx-auto pointer-events-none select-none blur-sm transition-[filter] duration-200"
            : "p-4 md:p-12 max-w-2xl mx-auto transition-[filter] duration-200"
        }
      >
        <h1 className="text-3xl font-bold mb-8">Manage</h1>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 divide-y divide-zinc-800 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.path}
              onClick={() => navigate(opt.path)}
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
      <LoginModal
        open={needsLogin}
        onLogin={login}
        onDismiss={() => navigate("/")}
        title="Sign in to manage"
        description="Log in with Google to open Manage and your account tools."
      />
    </>
  );
}
