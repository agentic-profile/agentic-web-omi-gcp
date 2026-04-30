import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { History, Calendar, MessageSquareQuote, Search, Trash2, Code, Sparkles } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";

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

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "memories", id));
      toast.success("Memory deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete memory");
    }
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
              <Card key={memory.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group overflow-hidden">
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
                    onClick={() => handleDelete(memory.id)}
                    className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </Button>
                </CardHeader>
                <CardContent className="p-0 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
                  {/* Raw Data Section */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      <Code size={14} className="text-blue-500" />
                      Raw JSON Data
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 max-h-[300px] overflow-auto">
                      <pre className="text-[10px] md:text-xs font-mono text-blue-400 leading-relaxed">
                        {JSON.stringify(memory.raw || { text: memory.text }, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="p-6 space-y-4 bg-orange-500/[0.02]">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      <Sparkles size={14} className="text-orange-500" />
                      AI Summary
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
    </div>
  );
}
