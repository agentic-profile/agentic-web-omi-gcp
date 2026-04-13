import React from "react";
import { Button } from "@/src/components/ui/button";
import { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Settings, History, BrainCircuit, Share2 } from "lucide-react";
import { motion } from "motion/react";

export default function LandingPage({ user, login }: { user: User | null; login: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-zinc-950 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-orange-500/10 rounded-full blur-[60px] md:blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl text-center relative z-10 pt-12 md:pt-0"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-orange-500 text-[10px] md:text-xs font-semibold mb-6 md:mb-8">
          <BrainCircuit size={14} />
          <span>AI-POWERED DEEPER SELF</span>
        </div>
        
        <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent leading-tight">
          You are complicated. <br className="hidden md:block" />Let Omi discover the deeper You.
        </h1>
        
        <p className="text-zinc-400 text-base md:text-xl mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed">
          Connect your Omi device to capture every conversation. AI will create an agent that deeply
          understands You, and that will search the Agentic Web for the best business connections, friends, and even love.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {user ? (
            <>
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-black font-bold px-12 h-14 text-lg"
                onClick={() => navigate("/setup")}
              >
                <Settings className="mr-2" size={20} /> Connect Omi
              </Button>
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 px-12 h-14 text-lg"
                onClick={() => navigate("/publish")}
              >
                <Share2 className="mr-2" size={20} /> Go LIVE!
              </Button>
            </>
          ) : (
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-black font-bold px-12 h-14 text-lg"
              onClick={login}
            >
              Get Started for Free
            </Button>
          )}
        </div>
      </motion.div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 md:mt-24 max-w-4xl w-full relative z-10 pb-12">
        <FeatureCard 
          icon={<Settings className="text-orange-500" />}
          title="Omi Integration"
          description="Seamlessly sync your Omi device memories via secure webhooks."
        />
        <FeatureCard 
          icon={<Share2 className="text-orange-500" />}
          title="Agentic Web"
          description="Go LIVE and let your AI agent represent you in the decentralized network to find connections."
        />
      </div>

      <footer className="relative z-10 mt-auto pt-8 pb-4 text-center">
        <p className="text-[10px] text-zinc-600 tracking-widest">
          Omi® is a registered trademark of Based Hardware Inc. This application is not affiliated with Omi or Based Hardware.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all duration-300">
      <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
