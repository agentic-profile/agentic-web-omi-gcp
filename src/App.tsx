/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { Button } from "@/src/components/ui/button";
import { Toaster } from "@/src/components/ui/sonner";
import LandingPage from "./pages/LandingPage";
import ReflectionChatPage from "./pages/chat/ReflectionChatPage";
import OmiSetupPage from "./pages/OmiSetupPage";
import OmiMemoriesPage from "./pages/OmiMemoriesPage";
import MorePage from "./pages/MorePage";
import MyAccountPage from "./pages/MyAccountPage";
import EditPromptsPage from "./pages/EditPromptsPage";
import TestWebhookPage from "./pages/TestWebhookPage";
import PublishPage from "./pages/publish/PublishPage";
import SettingsPage from "./pages/SettingsPage";
import ManagePage from "./pages/ManagePage";
import { Settings, History, Home, LogIn, LogOut, Menu, X, ArrowLeftRight, Share2 } from "lucide-react";
import AgentChatsPage from "./pages/chat/AgentChatsPage";
import AgentChatsDetailRoutePage from "./pages/chat/AgentChatsDetailRoutePage";
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/account/ensure", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });
          if (!res.ok) {
            console.error("Account provisioning failed:", await res.text());
          }
        } catch (error) {
          console.error("Account initialization failed:", error);
        }
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => signOut(auth);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <Router>
      <div className="flex flex-col md:flex-row h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 z-50">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Logo" className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Omi Agentic Web</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Sidebar (Desktop) / Overlay Menu (Mobile) */}
        <nav className={`
          fixed inset-0 z-40 bg-zinc-900 md:relative md:flex md:w-64 md:bg-zinc-900/50 border-r border-zinc-800 p-4 flex-col gap-8 transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <div className="hidden md:flex items-center gap-2 px-1">
            <img src="/favicon.svg" alt="Logo" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tight">Omi Agentic Web</span>
          </div>

          <div className="flex flex-col gap-2 flex-1 mt-12 md:mt-0">
            <NavLink to="/" icon={<Home size={18} />} label="Home" onClick={() => setIsMobileMenuOpen(false)} />
            {user && (
              <>
                <NavLink to="/setup" icon={<ArrowLeftRight size={18} />} label="Connect Omi" onClick={() => setIsMobileMenuOpen(false)} />
                <NavLink to="/publish" icon={<Share2 size={18} />} label="Go LIVE on the Agentic Web" onClick={() => setIsMobileMenuOpen(false)} />
                <NavLink to="/more" icon={<Settings size={18} />} label="More" onClick={() => setIsMobileMenuOpen(false)} />
              </>
            )}
          </div>

          <div className="pt-6 border-t border-zinc-800">
            {user ? (
              <div className="flex flex-col gap-4">
                <Link 
                  to="/account" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                >
                  <img src={user.photoURL || ""} alt="" className="w-8 h-8 rounded-full border border-zinc-700 group-hover:border-orange-500 transition-colors" referrerPolicy="no-referrer" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate group-hover:text-white transition-colors">{user.displayName}</span>
                    <span className="text-xs text-zinc-500 truncate">{user.email}</span>
                  </div>
                </Link>
                <Button variant="ghost" className="justify-start gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                  <LogOut size={18} /> Logout
                </Button>
              </div>
            ) : (
              <Button className="w-full gap-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold" onClick={() => { login(); setIsMobileMenuOpen(false); }}>
                <LogIn size={18} /> Login with Google
              </Button>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative">
          <Routes>
            <Route path="/" element={<LandingPage user={user} login={login} />} />
            <Route path="/reflection-chat" element={user ? <ReflectionChatPage user={user} /> : <LandingPage user={user} login={login} />} />
            <Route path="/history" element={user ? <OmiMemoriesPage user={user} /> : <LandingPage user={user} login={login} />} />
            <Route path="/setup" element={user ? <OmiSetupPage user={user} /> : <LandingPage user={user} login={login} />} />
            <Route path="/publish" element={user ? <PublishPage user={user} /> : <LandingPage user={user} login={login} />} />
            <Route path="/more" element={user ? <MorePage /> : <LandingPage user={user} login={login} />} />
            <Route path="/agent-chats" element={<AgentChatsPage user={user} login={login} />} />
            <Route path="/agent-chats/detail" element={<AgentChatsDetailRoutePage user={user} login={login} />} />
            <Route path="/manage" element={<ManagePage user={user} login={login} />} />
            <Route path="/account" element={user ? <MyAccountPage user={user} /> : <LandingPage user={user} login={login} />} />
            <Route path="/edit-prompts" element={user ? <EditPromptsPage user={user} /> : <LandingPage user={user} login={login} />} />
            <Route path="/settings" element={user ? <SettingsPage /> : <LandingPage user={user} login={login} />} />
            <Route path="/test" element={user ? <TestWebhookPage user={user} /> : <LandingPage user={user} login={login} />} />
          </Routes>
        </main>
        <Toaster position="top-right" theme="dark" />
      </div>
    </Router>
  );
}

function NavLink({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-200 font-medium"
    >
      {icon}
      {label}
    </Link>
  );
}

