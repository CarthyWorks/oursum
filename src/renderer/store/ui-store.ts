// src/renderer/store/ui-store.ts
// Zustand UI state — panel visibility, active tab, modal state.
// RULE: Always use selectors — never subscribe to full store.
import { create } from "zustand";

type ActiveTab = "transactions" | "rules" | "import" | "categories";

interface UiState {
  activeTab: ActiveTab;
  isSidebarOpen: boolean;
  isImportModalOpen: boolean;
  setActiveTab: (tab: ActiveTab) => void;
  setSidebarOpen: (open: boolean) => void;
  setImportModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: "transactions",
  isSidebarOpen: true,
  isImportModalOpen: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setImportModalOpen: (open) => set({ isImportModalOpen: open }),
}));
