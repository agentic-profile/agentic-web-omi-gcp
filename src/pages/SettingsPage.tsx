import React from "react";
import { useSettingsStore } from "../store/useSettingsStore";
import { Switch } from "../components/ui/switch";
import { Sliders, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function SettingsPage() {
  const { isExpertMode, setExpertMode } = useSettingsStore();

  return (
    <div className="p-4 md:p-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="grid gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Shield className="text-orange-500" size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">General Settings</CardTitle>
              <CardDescription>Configure your app experience</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <div className="font-medium text-zinc-100 flex items-center gap-2">
                  <Sliders size={16} className="text-zinc-400" />
                  Expert Mode
                </div>
                <div className="text-sm text-zinc-500">
                  Enable advanced controls and more detailed information
                </div>
              </div>
              <Switch
                checked={isExpertMode}
                onCheckedChange={setExpertMode}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
