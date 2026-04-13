import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, ShieldCheck, Zap, Rocket } from "lucide-react";

export default function OmiSetupPage({ user }: { user: User }) {
  const navigate = useNavigate();
  const [setupData, setSetupData] = useState<{ apiKey: string; webhookUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    user.getIdToken().then(token => {
      return fetch(`/omi/api-key`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          const error = new Error(data.error || "Failed to fetch setup data") as any;
          error.details = data.details;
          throw error;
        }
        return data;
      })
      .then((data) => {
        setSetupData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Setup fetch error:", err);
        const message = err.details ? `${err.message}: ${err.details}` : err.message;
        toast.error(message);
        setLoading(false);
      });
  }, [user?.uid]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
    toast.success(`Webhook URL copied to clipboard`);
  };

  if (loading) return <div className="p-8 md:p-12 flex justify-center">Loading setup data...</div>;

  return (
    <div className="p-4 md:p-12 max-w-4xl mx-auto">
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Connect Omi</h1>
        <p className="text-zinc-400 text-base md:text-lg">
          Integrate your <a href="https://www.omi.me/pages/product" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline inline-flex items-center gap-1">Omi device <ExternalLink size={14} /></a> to start capturing conversation memories automatically.
        </p>
      </div>

      <div className="grid gap-6 md:gap-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Zap className="text-blue-500" size={20} />
              </div>
              <CardTitle>Webhook URL</CardTitle>
            </div>
            <CardDescription>
              Configure this URL in your Omi device webhooks to send conversation data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                readOnly
                value={setupData?.webhookUrl || ""}
                className="font-mono bg-zinc-950 border-zinc-800"
              />
              <Button
                variant="outline"
                className="border-zinc-800 hover:bg-zinc-800"
                onClick={() => copyToClipboard(setupData?.webhookUrl || "")}
              >
                {copiedWebhook ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="p-6 md:p-8 rounded-2xl bg-orange-500/5 border border-orange-500/10">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ExternalLink size={18} className="text-orange-500" />
            How to setup Omi
          </h3>
          <ol className="space-y-6 text-zinc-400">
            <li className="flex gap-3 md:gap-4 items-start">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[10px] md:text-xs font-bold text-zinc-100 shrink-0 mt-0.5">1</span>
              <span className="text-sm md:text-base">Open the Omi mobile app and go to <strong>Settings</strong>.</span>
            </li>
            <li className="flex gap-3 md:gap-4 items-start">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[10px] md:text-xs font-bold text-zinc-100 shrink-0 mt-0.5">2</span>
              <span className="text-sm md:text-base">Scroll down to <strong>Developer Settings</strong> and select it.</span>
            </li>
            <li className="flex gap-3 md:gap-4 items-start">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[10px] md:text-xs font-bold text-zinc-100 shrink-0 mt-0.5">3</span>
              <span className="text-sm md:text-base">On the Developer Settings screen, scroll down to the <strong>Webhooks</strong> section.</span>
            </li>
            <li className="flex gap-3 md:gap-4 items-start">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[10px] md:text-xs font-bold text-zinc-100 shrink-0 mt-0.5">4</span>
              <span className="text-sm md:text-base">Toggle <strong>ON</strong> the <strong>Conversation Events</strong> webhook. A webhook Endpoint URL input box will appear.</span>
            </li>
            <li className="flex flex-col gap-3">
              <div className="flex gap-3 md:gap-4 items-start">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[10px] md:text-xs font-bold text-zinc-100 shrink-0 mt-0.5">5</span>
                <span className="text-sm md:text-base">Copy the following URL into the Endpoint URL field.</span>
              </div>
              <div className="ml-9 md:ml-10 mt-1">
                <div className="flex gap-2 max-w-md">
                  <Input
                    readOnly
                    value={setupData?.webhookUrl || ""}
                    className="h-9 text-xs font-mono bg-zinc-950 border-zinc-800"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-zinc-800 hover:bg-zinc-800"
                    onClick={() => copyToClipboard(setupData?.webhookUrl || "")}
                  >
                    {copiedWebhook ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
            </li>
            <li className="flex gap-3 md:gap-4 items-start">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[10px] md:text-xs font-bold text-zinc-100 shrink-0 mt-0.5">6</span>
              <span className="text-sm md:text-base">Save your settings. Your memories will now sync automatically!</span>
            </li>
          </ol>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-orange-500">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Rocket className="text-orange-500" size={20} />
              </div>
              <CardTitle>Start Syncing!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
              Keep your Omi on and connected to your phone and have some conversations! Come back to this webpage after a few conversations and Click 'More' and then 'Omi Memories' to see what was said.
            </p>
            <div className="pt-2">
              <Button 
                onClick={() => navigate("/publish")}
                className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-black font-bold gap-2 h-12 px-8 text-lg shadow-lg shadow-orange-500/20"
              >
                Next: Go LIVE! <Zap size={20} fill="currentColor" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
