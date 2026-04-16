import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Share2, Fingerprint, Rocket, ChevronDown, ChevronUp, Code } from "lucide-react";
import { toast } from "sonner";
import { DIDLink } from "../../components/DIDLink";
import { base64UrlEncode } from "../../utils/misc";
import { SelectPublisher, DEFAULT_PUBLISHER } from "./SelectPublisher";
import { useSettingsStore } from "../../store/useSettingsStore";

export default function PublishPage({ user }: { user: User }) {
  const [agentDid, setAgentDid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [publisherUrl, setPublisherUrl] = useState(DEFAULT_PUBLISHER);
  const { isExpertMode, setExpertMode } = useSettingsStore();

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "accounts", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setAgentDid(docSnap.data().agentDid || null);
      }
      setLoading(false);
    });

    const fetchPayload = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/publish/payload", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setPayload(data);
        }
      } catch (err) {
        console.error("Failed to fetch payload:", err);
      }
    };

    fetchPayload();
    return () => unsubscribe();
  }, [user]);

  const handleJoin = () => {
    if (!payload) {
      toast.error("Registration payload not ready. Please wait a moment.");
      return;
    }

    try {
      const base64url = base64UrlEncode(payload); 
      const url = `${publisherUrl}?payload=${base64url}`;
      window.open(url, "_matchwise");
    } catch (error) {
      console.error("Failed to encode payload:", error);
      toast.error("Failed to process registration. Please try again.");
    }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;

  return (
    <div className="p-4 md:p-12 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-orange-500/10 rounded-full mb-6">
          <Share2 className="text-orange-500" size={48} />
        </div>
        <h1 className="text-4xl font-bold mb-4">Go LIVE on the Agentic Web</h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Join the Agentic Web and let this agent find new business connections, friends, and even love.
        </p>
      </div>

      <div className="grid gap-8">
        <Card className="bg-zinc-900 border-zinc-800 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Rocket size={120} />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Rocket className="text-orange-500" size={24} />
              Ready to Launch?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">            
            <p className="text-zinc-300">
              By going LIVE with your agent, you allow it to interact with other agents in the decentralized network. 
              Your memories stay private, but your agent learns your preferences to represent you.
            </p>

            <Button 
              onClick={handleJoin}
              className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold h-12 text-lg"
            >
              Join Agentic Web
            </Button>

            <div className="flex justify-end items-center gap-2 pt-1">
              <label
                htmlFor="publish-expert-toggle"
                className="text-sm text-zinc-400 cursor-pointer select-none"
              >
                Expert
              </label>
              <Switch
                id="publish-expert-toggle"
                checked={isExpertMode}
                onCheckedChange={setExpertMode}
              />
            </div>


            {isExpertMode && (
              <>
                <RegistrationPayloadPanel payload={payload} />
                <SelectPublisher 
                  publisherUrl={publisherUrl} 
                  onPublisherUrlChange={setPublisherUrl} 
                />
              </>
            )}
          </CardContent>
        </Card>

        {agentDid && (
          <Card className="bg-orange-500/5 border-orange-500/20 overflow-hidden relative border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-orange-500">
                <Share2 size={24} />
                Congratulations!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-zinc-300">
                Your agent is now live on the Agentic Web. You can share your Agent DID to connect with others.
              </p>
              <div className="p-4 bg-zinc-950/50 border border-orange-500/10 rounded-xl space-y-2">
                <label className="text-xs font-semibold text-orange-500/50 uppercase tracking-wider flex items-center gap-2">
                  <Fingerprint size={14} />
                  Agent DID
                </label>
                <DIDLink did={agentDid} />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: "Business", desc: "Find partners and opportunities." },
            { title: "Social", desc: "Connect with like-minded people." },
            { title: "Personal", desc: "Discover meaningful relationships." }
          ].map((item) => (
            <div key={item.title} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <h3 className="font-bold text-zinc-100 mb-1">{item.title}</h3>
              <p className="text-xs text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function RegistrationPayloadPanel({ payload }: { payload: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="cursor-pointer hover:bg-zinc-800/50 transition-colors py-3 px-4 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-[10px] font-semibold flex items-center gap-2 text-zinc-500 uppercase tracking-wider">
          <Code size={12} />
          Registration Payload
        </div>
        <div className="text-zinc-500">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-zinc-800/50">
          <div className="relative">
            <pre className="bg-zinc-950 p-3 rounded-lg text-[10px] font-mono text-zinc-400 overflow-auto max-h-[300px]">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
