import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isSidebarExpanded: boolean;
  compactMode: boolean;
  reducedMotion: boolean;
  showSystemMetrics: boolean;
  showStatusDetails: boolean;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setCompactMode: (compact: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setShowSystemMetrics: (visible: boolean) => void;
  setShowStatusDetails: (visible: boolean) => void;
  resetInterfacePreferences: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarExpanded: false,
      compactMode: false,
      reducedMotion: false,
      showSystemMetrics: true,
      showStatusDetails: true,
      toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
      setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
      setCompactMode: (compact) => set({ compactMode: compact }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setShowSystemMetrics: (visible) => set({ showSystemMetrics: visible }),
      setShowStatusDetails: (visible) => set({ showStatusDetails: visible }),
      resetInterfacePreferences: () => set({
        compactMode: false,
        reducedMotion: false,
        showSystemMetrics: true,
        showStatusDetails: true,
        isSidebarExpanded: false,
      }),
    }),
    {
      name: "valleos-interface",
      version: 2,
      partialize: (state) => ({
        isSidebarExpanded: state.isSidebarExpanded,
        compactMode: state.compactMode,
        reducedMotion: state.reducedMotion,
        showSystemMetrics: state.showSystemMetrics,
        showStatusDetails: state.showStatusDetails,
      }),
    },
  ),
);
