import React, { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Switch } from "../components/ui/switch";
import { Users } from "lucide-react";

type AccountData = {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
  credits?: number;
  disabled?: boolean;
  pictureUrl?: string;
  agentDid?: string;
};

export default function ManageUsersPage({ user }: { user: User }) {
  const [myRole, setMyRole] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [updatingDisabled, setUpdatingDisabled] = useState<Record<string, boolean>>({});
  const [creditsModal, setCreditsModal] = useState<{ uid: string; open: boolean } | null>(null);
  const [creditsAmount, setCreditsAmount] = useState<string>("2.00");
  const [updatingCredits, setUpdatingCredits] = useState(false);
  const [roleModal, setRoleModal] = useState<{ uid: string; open: boolean } | null>(null);
  const [roleValue, setRoleValue] = useState<"admin" | "user">("user");
  const [updatingRole, setUpdatingRole] = useState(false);

  const usd = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  function openCreditsModal(uid: string) {
    setRemoteError(null);
    setCreditsAmount("2.00");
    setCreditsModal({ uid, open: true });
  }

  function closeCreditsModal() {
    setUpdatingCredits(false);
    setCreditsModal(null);
  }

  function openRoleModal(uid: string, currentRole: string | undefined) {
    setRemoteError(null);
    setRoleValue(currentRole === "admin" ? "admin" : "user");
    setRoleModal({ uid, open: true });
  }

  function closeRoleModal() {
    setUpdatingRole(false);
    setRoleModal(null);
  }

  async function setDisabledForUid(uid: string, disabled: boolean) {
    setRemoteError(null);
    setUpdatingDisabled((prev) => ({ ...prev, [uid]: true }));

    let previous: boolean | undefined;
    setAccounts((prev) => {
      const next = prev.map((a) => {
        if (a.uid !== uid) return a;
        previous = a.disabled;
        return { ...a, disabled };
      });
      return next;
    });

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(uid)}/disabled`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ disabled }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
    } catch (e) {
      setAccounts((prev) =>
        prev.map((a) => (a.uid === uid ? { ...a, disabled: previous } : a))
      );
      setRemoteError(e instanceof Error ? e.message : "Failed to update disabled flag");
    } finally {
      setUpdatingDisabled((prev) => ({ ...prev, [uid]: false }));
    }
  }

  async function addCreditsForUid(uid: string, amount: number) {
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/admin/accounts/${encodeURIComponent(uid)}/credits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return (await res.json()) as { ok?: boolean; uid?: string; credits?: number };
  }

  async function submitCreditsUpdate() {
    if (!creditsModal?.open) return;
    const uid = creditsModal.uid;
    const amount = Number(creditsAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRemoteError("Amount must be a positive number");
      return;
    }

    setUpdatingCredits(true);
    setRemoteError(null);
    try {
      const data = await addCreditsForUid(uid, amount);
      if (typeof data.credits === "number") {
        setAccounts((prev) => prev.map((a) => (a.uid === uid ? { ...a, credits: data.credits } : a)));
      }
      closeCreditsModal();
    } catch (e) {
      setRemoteError(e instanceof Error ? e.message : "Failed to update credits");
      setUpdatingCredits(false);
    }
  }

  async function setRoleForUid(uid: string, role: "admin" | "user") {
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/admin/accounts/${encodeURIComponent(uid)}/role`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return (await res.json()) as { ok?: boolean; uid?: string; role?: string };
  }

  async function submitRoleUpdate() {
    if (!roleModal?.open) return;
    const uid = roleModal.uid;
    setUpdatingRole(true);
    setRemoteError(null);
    try {
      const data = await setRoleForUid(uid, roleValue);
      const newRole = data.role === "admin" ? "admin" : "user";
      setAccounts((prev) => prev.map((a) => (a.uid === uid ? { ...a, role: newRole } : a)));
      closeRoleModal();
    } catch (e) {
      setRemoteError(e instanceof Error ? e.message : "Failed to update role");
      setUpdatingRole(false);
    }
  }

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "accounts", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as { role?: string };
        setMyRole(data.role);
      } else {
        setMyRole(undefined);
      }
    });
    return () => unsub();
  }, [user.uid]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setRemoteError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/admin/accounts", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed: ${res.status}`);
        }
        const data = (await res.json()) as { accounts?: AccountData[] };
        if (cancelled) return;
        setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      } catch (e) {
        if (cancelled) return;
        setRemoteError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = myRole === "admin";

  const rows = useMemo(() => {
    const copy = [...accounts];
    copy.sort((a, b) => String(a.email || a.name || a.uid).localeCompare(String(b.email || b.name || b.uid)));
    return copy;
  }, [accounts]);

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-12 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Manage Users</h1>
        <p className="text-zinc-400">You don’t have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-12 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-orange-500/10 rounded-lg">
          <Users className="text-orange-500" size={20} />
        </div>
        <h1 className="text-3xl font-bold">Manage Users</h1>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">System users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-zinc-400">Loading users…</div>
          ) : remoteError ? (
            <div className="text-red-400 whitespace-pre-wrap break-words">{remoteError}</div>
          ) : rows.length === 0 ? (
            <div className="text-zinc-400">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="py-3 pr-4 font-medium">Name</th>
                    <th className="py-3 pr-4 font-medium">Email</th>
                    <th className="py-3 pr-4 font-medium">Role</th>
                    <th className="py-3 pr-4 font-medium">Credits</th>
                    <th className="py-3 pr-4 font-medium">Disabled</th>
                    <th className="py-3 pr-4 font-medium">UID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {rows.map((a) => (
                    <tr key={a.uid} className="text-zinc-200">
                      <td className="py-3 pr-4 whitespace-nowrap">{a.name || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{a.email || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openRoleModal(a.uid, a.role)}
                          className={
                            (a.role === "admin"
                              ? "bg-blue-500/15 border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                              : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700") +
                            " inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold transition-colors"
                          }
                          title="Change role"
                        >
                          {(a.role === "admin" ? "admin" : "user").toUpperCase()}
                        </button>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{typeof a.credits === "number" ? usd.format(a.credits) : "—"}</span>
                          <button
                            type="button"
                            onClick={() => openCreditsModal(a.uid)}
                            className="h-6 w-6 rounded-full bg-green-600/20 border border-green-600/40 text-green-400 hover:bg-green-600/30 hover:text-green-300 transition-colors flex items-center justify-center"
                            aria-label="Add credits"
                            title="Add credits"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <Switch
                          checked={Boolean(a.disabled)}
                          onCheckedChange={(checked) => setDisabledForUid(a.uid, checked)}
                          className="align-middle"
                          disabled={Boolean(updatingDisabled[a.uid])}
                        />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap">{a.uid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {creditsModal?.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!updatingCredits) closeCreditsModal();
            }}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
            <div className="p-6 border-b border-zinc-800">
              <div className="text-lg font-semibold text-zinc-100">Update credits</div>
              <div className="text-sm text-zinc-400 mt-1">Enter a USD amount to add (default $2.00).</div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200" htmlFor="credits-amount">
                  Amount (USD)
                </label>
                <input
                  id="credits-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={updatingCredits}
                />
              </div>
              {remoteError ? (
                <div className="text-sm text-red-400 whitespace-pre-wrap break-words">{remoteError}</div>
              ) : null}
            </div>
            <div className="p-6 pt-0 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeCreditsModal}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-colors"
                disabled={updatingCredits}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitCreditsUpdate}
                className="px-4 py-2 rounded-lg bg-orange-500 text-black font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
                disabled={updatingCredits}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {roleModal?.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (!updatingRole) closeRoleModal();
            }}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
            <div className="p-6 border-b border-zinc-800">
              <div className="text-lg font-semibold text-zinc-100">Update role</div>
              <div className="text-sm text-zinc-400 mt-1">Choose a new role for this user.</div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-200" htmlFor="role-select">
                  Role
                </label>
                <select
                  id="role-select"
                  value={roleValue}
                  onChange={(e) => setRoleValue(e.target.value === "admin" ? "admin" : "user")}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={updatingRole}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              {remoteError ? (
                <div className="text-sm text-red-400 whitespace-pre-wrap break-words">{remoteError}</div>
              ) : null}
            </div>
            <div className="p-6 pt-0 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeRoleModal}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-colors"
                disabled={updatingRole}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRoleUpdate}
                className="px-4 py-2 rounded-lg bg-orange-500 text-black font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
                disabled={updatingRole}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

