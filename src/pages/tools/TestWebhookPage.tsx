import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { toast } from "sonner";
import { Play, Terminal, Globe } from "lucide-react";
import { getIdTokenOrLogout } from "@/src/auth/idToken";

export default function TestWebhookPage({ user }: { user: User }) {
  const [jsonInput, setJsonInput] = useState(JSON.stringify({ text: "This is a test memory from the dashboard." }, null, 2));
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    getIdTokenOrLogout(user).then(token => {
      fetch(`/omi/api-key`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.webhookUrl) {
            setWebhookUrl(data.webhookUrl);
          }
        })
        .catch(err => console.error("Failed to fetch webhook URL:", err));
    });
  }, [user?.uid]);

  const handleTest = async () => {
    if (!webhookUrl) {
      toast.error("Webhook URL not available. Please check your Omi setup.");
      return;
    }

    setLoading(true);
    try {
      const parsed = JSON.parse(jsonInput);
      
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      const data = await response.json();
      if (response.ok) {
        toast.success("Webhook test successful!");
      } else {
        toast.error(`Test failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Test error:", error);
      toast.error("Invalid JSON or network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Terminal className="text-orange-500" />
          Test Webhook
        </h1>
        <Button 
          onClick={handleTest} 
          disabled={loading || !webhookUrl}
          className="bg-orange-500 hover:bg-orange-600 text-black font-bold"
        >
          {loading ? "Testing..." : <><Play className="mr-2" size={18} /> Run Test</>}
        </Button>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Globe size={14} />
            Target Webhook URL
          </label>
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-xs text-zinc-300 break-all">
            {webhookUrl || "Loading webhook URL..."}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            JSON Payload
          </label>
          <Textarea 
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="min-h-[300px] font-mono bg-zinc-950 border-zinc-800 focus:border-orange-500/50 rounded-xl"
          />
        </div>

        <div className="p-4 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
          Note: This test sends a POST request to your unique Omi webhook endpoint. 
          If successful, the memory will appear in your Chat History.
        </div>
      </div>
    </div>
  );
}
