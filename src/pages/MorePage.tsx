import React from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, Terminal, FileEdit, ChevronRight, History, MessageSquare } from "lucide-react";

export default function MorePage() {
  const navigate = useNavigate();

  const options = [
    { label: "My Account", icon: <UserIcon size={20} />, path: "/more/account" },
    { label: "Omi Memories", icon: <History size={20} />, path: "/history" },
    { label: "Reflection Chat", icon: <MessageSquare size={20} />, path: "/chat" },
    { label: "Edit Prompts & Introduction", icon: <FileEdit size={20} />, path: "/more/prompts" },
    { label: "Test", icon: <Terminal size={20} />, path: "/more/test" },
  ];

  return (
    <div className="p-4 md:p-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">More</h1>
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
  );
}
