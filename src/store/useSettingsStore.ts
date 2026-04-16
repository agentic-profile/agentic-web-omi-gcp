import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  isExpertMode: boolean;
  setExpertMode: (val: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isExpertMode: false,
      setExpertMode: (val) => set({ isExpertMode: val }),
    }),
    {
      name: "omi-settings-storage", // unique name for the storage
    }
  )
);
