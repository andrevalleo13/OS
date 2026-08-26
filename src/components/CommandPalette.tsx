"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search, Coins, Calendar, Activity, BookOpen, CircleDot, Box, Clock, FileText, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getRecentNotes } from "@/app/actions/obsidian";
import { useRouter } from "next/navigation";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("ask-shadow");
  const [notes, setNotes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "g") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    const openPalette = () => setOpen(true);
    document.addEventListener("valleos:command-palette", openPalette);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("valleos:command-palette", openPalette);
    };
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  useEffect(() => {
    if (open) {
      // Fetch dynamic data when palette opens
      getRecentNotes(5).then(setNotes).catch(() => {});
      fetch('/api/calendar').then(r => r.json()).then(data => {
        if (data.success && data.events) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
          setEvents(data.events.filter((e: any) => e.start.startsWith(todayStr)));
        }
      }).catch(() => {});
    }
  }, [open]);

  // Helper to format note names
  const formatNoteName = (name: string) => {
    const parts = name.split('/');
    return parts[parts.length - 1].replace('.md', '');
  };

  const getCalendarColor = () => {
    return 'text-white/55 bg-white/[0.04] border-white/10';
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(2px)" }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex h-[520px] w-full max-w-[840px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111111]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:flex-row"
          >
            {/* Top highlight */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent z-10" />

            <Command value={value} onValueChange={setValue} label="Command Menu" className="w-full flex flex-col md:flex-row h-full bg-transparent" shouldFilter={true}>
              
              {/* Left Column (List) */}
              <div className="flex-1 flex flex-col border-r border-white/[0.04]">
                <div className="flex items-center px-4 border-b border-white/[0.06] h-[56px] shrink-0">
                  <Search className="w-4 h-4 text-[#666] mr-3" />
                  <Command.Input 
                    autoFocus
                    placeholder="Ask Shadow or search ValleOS..." 
                    className="flex-1 bg-transparent border-none outline-none text-[#ededed] placeholder-[#666] font-sans text-[15px]"
                  />
                  <kbd className="hidden sm:inline-flex px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.05] rounded-[4px] text-[10px] font-mono text-[#888]">ESC</kbd>
                </div>

                <Command.List className="flex-1 overflow-y-auto p-2 scrollbar-none">
                  <Command.Empty className="py-12 text-center text-[13px] text-[#666]">No results found.</Command.Empty>

                  <Command.Group heading="Shadow AI" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[#666] [&_[cmdk-group-heading]]:font-semibold mb-2">
                    <CommandItem value="ask-shadow" icon={<CircleDot className="w-4 h-4" />} label="Hablar con Shadow" shortcut="S" onSelect={() => navigate("/shadow")} />
                    <CommandItem value="log-expense" icon={<Coins className="w-4 h-4" />} label="Registrar movimiento" shortcut="E" onSelect={() => navigate("/finances?intent=transaction")} />
                    <CommandItem value="schedule-work" icon={<Calendar className="w-4 h-4" />} label="Bloquear tiempo" shortcut="D" onSelect={() => navigate("/calendar?new=1")} />
                  </Command.Group>

                  {events.length > 0 && (
                    <Command.Group heading="Today's Agenda" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[#666] [&_[cmdk-group-heading]]:font-semibold border-t border-white/[0.04] pt-2 mb-2">
                      {events.map((e: any, i: number) => {
                        const parts = e.start.split(' ');
                        const timePart = parts.slice(1).join(' ').replace(/:00\s/, ' ');
                        return (
                          <CommandItem 
                            key={e.id} 
                            value={`event-${i}`} 
                            icon={<Clock className="w-4 h-4" />} 
                            label={e.title} 
                            subtitle={timePart}
                            onSelect={() => navigate("/calendar")} 
                          />
                        );
                      })}
                    </Command.Group>
                  )}

                  {notes.length > 0 && (
                    <Command.Group heading="Recent Notes" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[#666] [&_[cmdk-group-heading]]:font-semibold border-t border-white/[0.04] pt-2 mb-2">
                      {notes.map((n: any, i: number) => (
                        <CommandItem 
                          key={n.name} 
                          value={`note-${i}`} 
                          icon={<FileText className="w-4 h-4" />} 
                          label={formatNoteName(n.name)} 
                          onSelect={() => navigate(`/obsidian?note=${encodeURIComponent(n.name)}`)} 
                        />
                      ))}
                    </Command.Group>
                  )}

                  <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[#666] [&_[cmdk-group-heading]]:font-semibold border-t border-white/[0.04] pt-2">
                    <CommandItem value="open-obsidian" icon={<BookOpen className="w-4 h-4" />} label="Abrir Obsidian" shortcut="O" onSelect={() => navigate("/obsidian")} />
                    <CommandItem value="start-workout" icon={<Activity className="w-4 h-4" />} label="Abrir entrenamiento" shortcut="W" onSelect={() => navigate("/gym")} />
                  </Command.Group>
                </Command.List>
              </div>

              {/* Right Column (Details Pane) */}
              <div className="hidden md:flex flex-col w-[340px] bg-black/20 border-l border-white/[0.02]">
                <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
                  {value === "ask-shadow" && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] border border-white/10">
                        <CircleDot className="w-8 h-8 text-[#ededed]" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-medium text-[#ededed]">Shadow AI</h3>
                        <p className="text-[12px] text-[#888] mt-2 leading-relaxed">Engage with your second brain&apos;s core intelligence. Ask questions, log data, or execute workflows via natural language.</p>
                      </div>
                    </div>
                  )}

                  {value === "log-expense" && (
                    <div className="flex flex-col items-start h-full">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4 border border-white/10">
                        <Coins className="w-5 h-5 text-white/65" />
                      </div>
                      <h3 className="text-[15px] font-medium text-[#ededed] mb-2">Log Expense</h3>
                      <p className="text-[12px] text-[#888] leading-relaxed">Record a new financial transaction into your ValleOS database. Shadow will automatically categorize it.</p>
                    </div>
                  )}

                  {value === "schedule-work" && (
                    <div className="flex flex-col items-start h-full">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4 border border-white/10">
                        <Calendar className="w-5 h-5 text-white/65" />
                      </div>
                      <h3 className="text-[15px] font-medium text-[#ededed] mb-2">Deep Work</h3>
                      <p className="text-[12px] text-[#888] leading-relaxed">Block out calendar time for uninterrupted focus. Silences notifications and triggers focus mode.</p>
                    </div>
                  )}

                  {value.startsWith("event-") && events[parseInt(value.split("-")[1])] && (
                    <div className="flex flex-col items-start h-full">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                        <Clock className="w-5 h-5 text-[#ededed]" />
                      </div>
                      <h3 className="text-[15px] font-medium text-[#ededed] mb-1">{events[parseInt(value.split("-")[1])].title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-mono border ${getCalendarColor()}`}>
                          {events[parseInt(value.split("-")[1])].calendar.toUpperCase()}
                        </span>
                        <span className="text-[12px] text-[#888]">
                           {events[parseInt(value.split("-")[1])].start.split(' ').slice(1).join(' ').replace(/:00\s/, ' ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {value.startsWith("note-") && notes[parseInt(value.split("-")[1])] && (
                    <div className="flex flex-col items-start h-full">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                        <FileText className="w-5 h-5 text-[#ededed]" />
                      </div>
                      <h3 className="text-[15px] font-medium text-[#ededed] mb-1">{formatNoteName(notes[parseInt(value.split("-")[1])].name)}</h3>
                      <p className="text-[10px] font-mono text-[#666] mb-4">{notes[parseInt(value.split("-")[1])].name}</p>
                      
                      <div className="w-full h-[1px] bg-white/[0.06] mb-4" />
                      
                      <div className="text-[12px] text-[#888] leading-relaxed font-sans whitespace-pre-wrap">
                        {notes[parseInt(value.split("-")[1])].content}
                      </div>
                    </div>
                  )}

                  {(!value || (!value.startsWith("ask-shadow") && !value.startsWith("log-expense") && !value.startsWith("schedule-work") && !value.startsWith("event-") && !value.startsWith("note-"))) && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <Box className="w-5 h-5 text-[#666]" />
                      </div>
                      <h3 className="text-[13px] font-medium text-[#ededed]">ValleOS</h3>
                      <p className="text-[11px] text-[#666] mt-1">Select an action to view details</p>
                    </div>
                  )}
                </div>
              </div>

            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CommandItem({ value, icon, label, subtitle, shortcut, onSelect }: { value: string, icon: React.ReactNode, label: string, subtitle?: string, shortcut?: string, onSelect: () => void }) {
  return (
    <Command.Item 
      value={value}
      className="group flex items-center justify-between px-3 py-3 rounded-[8px] cursor-pointer hover:bg-white/[0.06] data-[selected=true]:bg-white/[0.06] outline-none transition-colors"
      onSelect={onSelect}
    >
      <div className="flex items-center gap-3 truncate pr-4">
        <div className="text-[#666] group-hover:text-[#ededed] group-data-[selected=true]:text-[#ededed] transition-colors shrink-0">
          {icon}
        </div>
        <div className="flex flex-col truncate">
          <span className="text-[13px] font-medium text-[#aaa] group-hover:text-[#ededed] group-data-[selected=true]:text-[#ededed] transition-colors truncate">
            {label}
          </span>
          {subtitle && (
            <span className="text-[10px] text-[#666] group-hover:text-[#888] group-data-[selected=true]:text-[#888] transition-colors">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ChevronRight className="w-3.5 h-3.5 text-[#333] group-data-[selected=true]:text-[#666] opacity-0 group-data-[selected=true]:opacity-100 transition-all" />
        {shortcut && (
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 bg-white/[0.03] border border-white/[0.05] rounded-[4px] text-[10px] font-mono text-[#666] group-hover:text-[#aaa] group-data-[selected=true]:text-[#aaa] transition-colors">
            {shortcut}
          </kbd>
        )}
      </div>
    </Command.Item>
  );
}
