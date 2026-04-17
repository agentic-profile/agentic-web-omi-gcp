import { useState, useRef, useEffect } from "react";
import { User } from "firebase/auth";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Send, Bot, User as UserIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ReflectionChatPage({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        throw new Error(data.error || "No reply from server");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <header className="h-16 border-b border-zinc-800 flex items-center px-4 md:px-8 justify-between bg-zinc-900/30 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Bot className="text-orange-500" size={20} md:size={24} />
          <h2 className="font-bold text-base md:text-lg">Memory Assistant</h2>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 md:p-8" ref={scrollRef}>
        <div className="max-w-3xl mx-auto flex flex-col gap-4 md:gap-6 pb-24">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 md:mb-6 border border-zinc-800">
                <Bot className="text-zinc-500" size={24} md:size={32} />
              </div>
              <h3 className="text-lg md:text-xl font-semibold mb-2">How can I help you today?</h3>
              <p className="text-zinc-500 text-sm md:text-base max-w-xs md:max-w-sm">
                Ask me anything about your recorded memories or start a new conversation.
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 md:gap-4 ${msg.role === "assistant" ? "bg-zinc-900/50 p-4 md:p-6 rounded-2xl border border-zinc-800" : "px-4 md:px-6"}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-orange-500 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                  {msg.role === "assistant" ? <Bot size={18} /> : <UserIcon size={18} />}
                </div>
                <div className="flex-1 space-y-1 md:space-y-2 overflow-hidden">
                  <p className="text-xs md:text-sm font-semibold text-zinc-400">
                    {msg.role === "assistant" ? "Assistant" : "You"}
                  </p>
                  <p className="text-sm md:text-base text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-3 md:gap-4 bg-zinc-900/50 p-4 md:p-6 rounded-2xl border border-zinc-800">
              <div className="w-8 h-8 rounded-lg bg-orange-500 text-black flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-xs md:text-sm">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 md:p-8 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
        <div className="max-w-3xl mx-auto relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your memories..."
            className="h-12 md:h-14 bg-zinc-900 border-zinc-800 focus:border-orange-500/50 focus:ring-orange-500/20 pr-14 md:pr-16 rounded-xl text-sm md:text-base"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 top-1.5 h-9 w-9 md:right-2 md:top-2 md:h-10 md:w-10 bg-orange-500 hover:bg-orange-600 text-black rounded-lg p-0"
          >
            <Send size={16} md:size={18} />
          </Button>
        </div>
        <p className="text-center text-[9px] md:text-[10px] text-zinc-600 mt-3 uppercase tracking-widest">
          Powered by Gemini AI & Omi Memories
        </p>
      </div>
    </div>
  );
}
