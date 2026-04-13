import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";

export default function EditPromptsPage({ user }: { user: User }) {
  const [prompts, setPrompts] = useState({
    chat_instruction: "",
    introduction: "",
    memory_summarize: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPrompts = async () => {
      const docSnap = await getDoc(doc(db, "accounts", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPrompts({
          chat_instruction: data.chat_instruction || "",
          introduction: data.introduction || "",
          memory_summarize: data.memory_summarize || ""
        });
      }
      setLoading(false);
    };
    fetchPrompts();
  }, [user.uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "accounts", user.uid), prompts);
      toast.success("Prompts & Introduction updated successfully");
    } catch (error) {
      console.error("Error updating prompts:", error);
      toast.error("Failed to update prompts");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-zinc-500">Loading...</div>;

  return (
    <div className="p-4 md:p-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Edit Prompts & Introduction</h1>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-black font-bold"
        >
          {saving ? "Saving..." : <><Save className="mr-2" size={18} /> Save Changes</>}
        </Button>
      </div>

      <div className="space-y-8">
        <div className="space-y-3">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Introduction</label>
          <p className="text-xs text-zinc-500">The first message the agent sends when starting a new conversation.</p>
          <Textarea 
            value={prompts.introduction}
            onChange={(e) => setPrompts({ ...prompts, introduction: e.target.value })}
            placeholder="Enter introduction message..."
            className="min-h-[100px] bg-zinc-900 border-zinc-800 focus:border-orange-500/50 rounded-xl"
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Chat Instruction</label>
          <p className="text-xs text-zinc-500">Defines how the AI assistant behaves during chat sessions.</p>
          <Textarea 
            value={prompts.chat_instruction}
            onChange={(e) => setPrompts({ ...prompts, chat_instruction: e.target.value })}
            placeholder="Enter chat system instructions..."
            className="min-h-[200px] bg-zinc-900 border-zinc-800 focus:border-orange-500/50 rounded-xl"
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Memory Summarize Prompt</label>
          <p className="text-xs text-zinc-500">Defines how the AI summarizes conversation memories from your Omi device.</p>
          <Textarea 
            value={prompts.memory_summarize}
            onChange={(e) => setPrompts({ ...prompts, memory_summarize: e.target.value })}
            placeholder="Enter memory summarization instructions..."
            className="min-h-[200px] bg-zinc-900 border-zinc-800 focus:border-orange-500/50 rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}
