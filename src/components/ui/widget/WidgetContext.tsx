"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface WidgetContextType {
  activeWidgetId: string | null;
  setActiveWidgetId: (id: string | null) => void;
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export function WidgetProvider({ children }: { children: ReactNode }) {
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  return (
    <WidgetContext.Provider value={{ activeWidgetId, setActiveWidgetId }}>
      {children}
    </WidgetContext.Provider>
  );
}

export function useWidget() {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
}

export function WidgetBackdrop() {
  const { activeWidgetId, setActiveWidgetId } = useWidget();
  
  if (!activeWidgetId) return null;
  
  return (
    <div 
      className="fixed inset-0 z-[5]" 
      onClick={() => setActiveWidgetId(null)} 
    />
  );
}
