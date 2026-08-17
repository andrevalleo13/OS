"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search, Coins, Calendar, Activity, BookOpen, MessageSquare } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  // Toggle the menu when ⌘G is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "g" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]">
      <div className="w-full max-w-xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <Command label="Command Menu" className="w-full">
          <div className="flex items-center px-4 py-3 border-b border-[#222]">
            <Search className="w-4 h-4 text-gray-500 mr-3" />
            <Command.Input 
              autoFocus
              placeholder="Ask Shadow or search ValleOS..." 
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 font-sans text-lg"
            />
            <kbd className="hidden sm:inline-flex px-2 py-1 bg-[#1a1a1a] rounded text-xs font-mono text-gray-400">ESC</kbd>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-none">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">No results found.</Command.Empty>

            <Command.Group heading="Shadow AI Actions" className="px-2 py-2 text-xs font-medium text-gray-500">
              <Command.Item className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 rounded-lg cursor-pointer hover:bg-[#ff5500]/10 hover:text-[#ff5500] data-[selected=true]:bg-[#ff5500]/10 data-[selected=true]:text-[#ff5500] transition-colors outline-none" onSelect={() => setOpen(false)}>
                <Coins className="w-4 h-4" /> Log Expense
              </Command.Item>
              <Command.Item className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 rounded-lg cursor-pointer hover:bg-[#ff5500]/10 hover:text-[#ff5500] data-[selected=true]:bg-[#ff5500]/10 data-[selected=true]:text-[#ff5500] transition-colors outline-none" onSelect={() => setOpen(false)}>
                <Calendar className="w-4 h-4" /> Schedule Deep Work
              </Command.Item>
              <Command.Item className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 rounded-lg cursor-pointer hover:bg-[#ff5500]/10 hover:text-[#ff5500] data-[selected=true]:bg-[#ff5500]/10 data-[selected=true]:text-[#ff5500] transition-colors outline-none" onSelect={() => setOpen(false)}>
                <Activity className="w-4 h-4" /> Start Workout
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Navigation" className="px-2 py-2 text-xs font-medium text-gray-500 border-t border-[#1a1a1a]">
              <Command.Item className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 rounded-lg cursor-pointer hover:bg-white/10 data-[selected=true]:bg-white/10 transition-colors outline-none" onSelect={() => setOpen(false)}>
                <BookOpen className="w-4 h-4" /> Open Obsidian Vault
              </Command.Item>
              <Command.Item className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 rounded-lg cursor-pointer hover:bg-white/10 data-[selected=true]:bg-white/10 transition-colors outline-none" onSelect={() => setOpen(false)}>
                <MessageSquare className="w-4 h-4" /> Ask Shadow
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
