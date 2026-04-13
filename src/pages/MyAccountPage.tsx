import React, { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Coins, Shield, UserCircle, Fingerprint } from "lucide-react";
import { DIDLink } from "../components/DIDLink";

interface AccountData {
  name: string;
  pictureUrl: string;
  role: string;
  credits: number;
  agentDid?: string;
}

export default function MyAccountPage({ user }: { user: User }) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "accounts", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setAccount(docSnap.data() as AccountData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  if (loading) return <div className="p-12 text-center">Loading account...</div>;

  return (
    <div className="p-4 md:p-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>
      
      <div className="flex flex-col items-center gap-6 mb-12">
        <div className="relative">
          <img 
            src={account?.pictureUrl || user.photoURL || ""} 
            alt={account?.name} 
            className="w-32 h-32 rounded-full border-4 border-orange-500/20"
            referrerPolicy="no-referrer"
          />
          <div className="absolute -bottom-2 -right-2 bg-zinc-900 p-2 rounded-full border border-zinc-800">
            <UserCircle size={24} className="text-orange-500" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{account?.name || user.displayName}</h2>
          <p className="text-zinc-500">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Coins className="text-orange-500" size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">Credits</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-100">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(account?.credits || 0)}
            </p>
            <p className="text-sm text-zinc-500 mt-1">Available balance for AI processing</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="text-blue-500" size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">Role</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-medium text-zinc-100 capitalize">{account?.role || "User"}</p>
            <p className="text-sm text-zinc-500 mt-1">Your current access level</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Fingerprint className="text-purple-500" size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">Agent DID</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {account?.agentDid ? (
              <DIDLink did={account.agentDid} />
            ) : (
              <p className="text-sm text-zinc-500 italic">Not ready</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
