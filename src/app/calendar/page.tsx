"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  addDays, 
  addWeeks,
  addMonths,
  subMonths,
  startOfWeek, 
  format, 
  isSameDay, 
  isToday,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  differenceInMinutes
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Calendar as CalendarIcon, Clock, Trash2, ChevronLeft, ChevronRight, CalendarDays, CalendarPlus, Check, X } from 'lucide-react';
import { uiAudio } from '@/utils/audio';

type CalendarEvent = {
  id: string;
  title: string;
  start: string; // "2026-8-19 10:00:00"
  end: string;
  calendar: string;
};

type ViewMode = 'agenda' | 'week' | 'month';

const CALENDAR_COLORS: Record<string, { bg: string, border: string, text: string, dot: string, hex: string }> = {
  'andrevalleo13@gmail.com': { bg: 'bg-white/[0.075]', border: 'border-white/20', text: 'text-white/75', dot: 'bg-white/70', hex: '#b8b8b8' },
  'Work': { bg: 'bg-white/[0.055]', border: 'border-white/15', text: 'text-white/60', dot: 'bg-white/50', hex: '#888888' },
  'Home': { bg: 'bg-white/[0.035]', border: 'border-white/10', text: 'text-white/45', dot: 'bg-white/35', hex: '#5f5f5f' },
};
const getCalColor = (cal: string) => CALENDAR_COLORS[cal] || CALENDAR_COLORS['andrevalleo13@gmail.com'];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  
  const [selectedCalendars, setSelectedCalendars] = useState<Set<string>>(new Set(['andrevalleo13@gmail.com', 'Work', 'Home']));
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  // Time indicator state
  const [now, setNow] = useState(new Date());

  const titleInputRef = useRef<HTMLInputElement>(null);

  const [newEvent, setNewEvent] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    endTime: '11:00',
    calendar: 'andrevalleo13@gmail.com'
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    if (new URLSearchParams(window.location.search).get('new') === '1') setIsAdding(true);
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c' && !isAdding && !activeEvent && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setIsAdding(true);
      }
      
      if (e.key === 'Escape') {
        if (isAdding) setIsAdding(false);
        if (activeEvent) setActiveEvent(null);
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isAdding) {
        e.preventDefault();
        document.getElementById('new-calendar-event-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding, newEvent, activeEvent]);

  useEffect(() => {
    if (isAdding) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isAdding]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e?.preventDefault();
    if (!newEvent.title) return;
    uiAudio.playSend();
    try {
      await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      });
      setIsAdding(false);
      setNewEvent({ ...newEvent, title: '' });
      fetchEvents();
    } catch {}
  };

  const handleDelete = async (id: string, calendar: string) => {
    uiAudio.playSend();
    try {
      await fetch('/api/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, calendar })
      });
      setActiveEvent(null);
      fetchEvents();
    } catch {}
  };

  const parseEventDate = (dateStr: string) => {
    try {
      const [datePart, timePart] = dateStr.split(' ');
      const [y, m, d] = datePart.split('-');
      return new Date(parseInt(y), parseInt(m)-1, parseInt(d), ...timePart.split(':').map(Number));
    } catch {
      return new Date();
    }
  };

  const getFilteredEvents = () => events.filter(ev => selectedCalendars.has(ev.calendar));

  const getEventsForDay = (day: Date) => {
    return getFilteredEvents().filter(ev => {
      const evDate = parseEventDate(ev.start);
      return isSameDay(evDate, day);
    }).sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime());
  };

  const nextPeriod = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 7));
  };
  
  const prevPeriod = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, -1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, -1));
    else setCurrentDate(addDays(currentDate, -7));
  };

  const toggleCalendar = (cal: string) => {
    const newSet = new Set(selectedCalendars);
    if (newSet.has(cal)) newSet.delete(cal);
    else newSet.add(cal);
    setSelectedCalendars(newSet);
  };

  const getDynamicTitle = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: es });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(start, end)) return `${format(start, 'd')} - ${format(end, 'd')} ${format(end, 'MMMM yyyy', { locale: es })}`;
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMMM yyyy', { locale: es })}`;
    }
    const end = addDays(currentDate, 13);
    if (isSameMonth(currentDate, end)) return `${format(currentDate, 'd')} - ${format(end, 'd')} ${format(end, 'MMMM yyyy', { locale: es })}`;
    return `${format(currentDate, 'd MMM', { locale: es })} - ${format(end, 'd MMMM yyyy', { locale: es })}`;
  };

  // --- Views --- //
  
  const renderTimeGridWeekView = () => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
    const hours = Array.from({ length: 24 }).map((_, i) => i);

    // Calculate position and height based on 60px per hour
    const HOUR_HEIGHT = 60;
    const getTopPosition = (date: Date) => (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;
    const getEventHeight = (ev: CalendarEvent) => {
      const start = parseEventDate(ev.start);
      const end = parseEventDate(ev.end);
      const diffMins = differenceInMinutes(end, start);
      return Math.max((diffMins / 60) * HOUR_HEIGHT, 24); // min height 24px
    };

    return (
      <div className="flex-1 w-full flex flex-col overflow-hidden bg-[#0a0a0a] border border-white/[0.04] rounded-[24px] shadow-2xl relative">
        {/* Header Days */}
        <div className="flex border-b border-white/[0.04] bg-[#0d0d0d] sticky top-0 z-30 ml-16">
          {weekDays.map((day, i) => {
            const isTodayDate = isToday(day);
            return (
              <div key={i} className="flex-1 py-3 flex flex-col items-center border-r border-white/[0.04] last:border-r-0">
                <span className={`text-[10px] uppercase font-mono tracking-widest ${isTodayDate ? 'text-white' : 'text-white/40'}`}>
                  {format(day, 'EEE', { locale: es })}
                </span>
                <span className={`text-xl font-light mt-0.5 ${isTodayDate ? 'text-white' : 'text-white/80'}`}>
                  {format(day, 'dd')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Scrollable Time Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative flex bg-[#0a0a0a]">
          
          {/* Y-Axis Hours */}
          <div className="w-16 flex flex-col border-r border-white/[0.08] bg-[#0a0a0a] sticky left-0 z-20">
            {hours.map(h => (
              <div key={h} className="h-[60px] text-[10px] font-medium text-white/30 text-right pr-3 -translate-y-2">
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Grid Area */}
          <div className="flex-1 flex relative">
            {/* Horizontal Hour Lines */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {hours.map(h => (
                <div key={h} className="h-[60px] border-b border-white/[0.05] w-full" />
              ))}
            </div>

            {/* Red Line (Current Time) */}
            {weekDays.some(d => isSameDay(d, now)) && (
              <div 
                className="pointer-events-none absolute left-0 right-0 z-30 flex items-center border-t-[1.5px] border-white/50" 
                style={{ top: getTopPosition(now) }}
              >
                <div className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-white/65 shadow-[0_0_12px_rgba(255,255,255,0.24)]" />
              </div>
            )}

            {/* Day Columns */}
            {weekDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isTodayDate = isToday(day);

              return (
                <div key={i} className={`flex-1 border-r border-white/[0.05] relative last:border-r-0 ${isTodayDate ? 'bg-white/[0.02]' : ''}`}>
                  {dayEvents.map(ev => {
                    const c = getCalColor(ev.calendar);
                    const top = getTopPosition(parseEventDate(ev.start));
                    const height = getEventHeight(ev);
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={ev.id}
                        onClick={() => setActiveEvent(ev)}
                        className={`absolute left-1 right-1 rounded-md p-2 cursor-pointer border shadow-sm overflow-hidden transition-transform hover:scale-[1.02] hover:z-20 ${c.bg} ${c.border}`}
                        style={{ top, height }}
                      >
                        <p className={`text-[11px] font-semibold leading-tight truncate ${c.text}`}>{ev.title}</p>
                        <p className={`text-[9px] mt-0.5 opacity-70 font-mono ${c.text}`}>
                          {format(parseEventDate(ev.start), 'HH:mm')} - {format(parseEventDate(ev.end), 'HH:mm')}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex-1 w-full flex flex-col overflow-hidden bg-[#0a0a0a] border border-white/[0.04] rounded-[24px] shadow-xl">
        <div className="grid border-b border-white/[0.04] bg-[#0d0d0d]" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, i) => (
            <div key={i} className="py-2.5 text-center text-[10px] uppercase font-medium tracking-widest text-white/40 border-r border-white/[0.04] last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
          {days.map((day, i) => {
            const dayEvents = getEventsForDay(day);
            const isTodayDate = isToday(day);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={i} 
                className={`relative border-r border-b border-white/[0.04] p-1.5 flex flex-col transition-colors group ${!isCurrentMonth ? 'bg-[#050505]' : 'bg-[#0a0a0a]'} ${isTodayDate ? 'bg-white/[0.03]' : ''}`}
              >
                <div className={`text-[11px] font-medium text-right mb-1 mr-1 ${isTodayDate ? 'text-white' : isCurrentMonth ? 'text-white/70' : 'text-white/20'}`}>
                  <span className={isTodayDate ? 'bg-white/20 px-1.5 py-0.5 rounded-md' : ''}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar no-scrollbar">
                  {dayEvents.slice(0, 4).map((ev, j) => {
                    const c = getCalColor(ev.calendar);
                    return (
                      <div 
                        key={j}
                        onClick={() => setActiveEvent(ev)}
                        className={`truncate text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] cursor-pointer hover:opacity-80 transition-opacity border ${c.bg} ${c.border} ${c.text}`}
                      >
                        {format(parseEventDate(ev.start), 'HH:mm')} {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 4 && (
                    <div className="text-[9px] text-center text-white/30 font-medium">
                      + {dayEvents.length - 4} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    const startDate = currentDate;
    const days = Array.from({ length: 14 }).map((_, i) => addDays(startDate, i));
    const hasAnyContent = days.some(day => getEventsForDay(day).length > 0);

    if (!hasAnyContent) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-white/20 h-full pb-20">
          <CalendarDays className="w-10 h-10 mb-4 opacity-50" />
          <p className="text-sm font-medium tracking-wide">No hay eventos en este periodo</p>
        </div>
      );
    }

    return (
      <div className="flex-1 w-full max-w-3xl mx-auto overflow-y-auto custom-scrollbar pr-4 py-8">
        <div className="space-y-12">
          {days.map((day, i) => {
            const dayEvents = getEventsForDay(day);
            if (dayEvents.length === 0) return null;

            return (
              <div key={i} className="flex gap-10 relative">
                <div className="w-16 flex flex-col items-start pt-1">
                  <span className="text-[10px] uppercase font-medium tracking-widest text-white/40">
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className={`text-2xl font-light mt-0.5 ${isToday(day) ? 'text-white' : 'text-white/80'}`}>
                    {format(day, 'dd')}
                  </span>
                </div>
                
                <div className="absolute left-[4.8rem] top-3 bottom-[-3rem] w-px bg-white/[0.06] last:hidden" />
                <div className="absolute left-[4.65rem] top-4 w-1.5 h-1.5 rounded-full bg-white/30 ring-4 ring-[#0a0a0a]" />

                <div className="flex-1 space-y-2">
                  {dayEvents.map((ev, j) => {
                    const evDate = parseEventDate(ev.start);
                    const c = getCalColor(ev.calendar);
                    
                    return (
                      <div 
                        key={j}
                        onClick={() => setActiveEvent(ev)}
                        className={`group relative flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:scale-[1.01] transition-all bg-[#0d0d0d] border-white/[0.04] hover:border-white/[0.08]`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono text-white/40 w-10 text-right">
                            {format(evDate, 'HH:mm')}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                            <span className="text-sm font-medium text-white/90">{ev.title}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMiniCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-white/90 capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="grid gap-1 text-center mb-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="text-[10px] font-medium text-white/30">{d}</div>
          ))}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map((day, i) => {
            const isCurrentM = isSameMonth(day, monthStart);
            const isT = isToday(day);
            const isSelected = isSameDay(day, currentDate);
            
            return (
              <button 
                key={i}
                onClick={() => { setCurrentDate(day); setViewMode('week'); }}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors
                  ${!isCurrentM ? 'text-white/20' : 'text-white/70'}
                  ${isSelected && !isT ? 'bg-white/10 text-white' : 'hover:bg-white/5'}
                  ${isT ? 'bg-white/75 text-black' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100vh-112px)] bg-[#050505] text-[#ededed] flex overflow-hidden font-sans rounded-[24px] border border-white/[0.04] shadow-2xl">
      
      {/* Sidebar (Filters & Mini-Cal) */}
      <div className="w-[280px] bg-[#080808] border-r border-white/[0.04] p-6 flex flex-col shrink-0">
        
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl font-medium hover:bg-gray-200 active:scale-[0.98] transition-all shadow-lg mb-8 text-[13px]"
        >
          <Plus className="w-4 h-4 text-black" /> Nuevo Evento
        </button>

        {renderMiniCalendar()}

        <div>
          <h3 className="text-[10px] font-medium text-white/40 uppercase tracking-widest mb-3">Tus Calendarios</h3>
          <div className="space-y-1.5">
            {[
              { id: 'andrevalleo13@gmail.com', label: 'Personal', color: '#b8b8b8' },
              { id: 'Work', label: 'Trabajo', color: '#888888' },
              { id: 'Home', label: 'Casa', color: '#5f5f5f' }
            ].map(cal => (
              <label key={cal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors group">
                <div 
                  className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${selectedCalendars.has(cal.id) ? 'border-transparent' : 'border-white/20 group-hover:border-white/40'}`}
                  style={{ backgroundColor: selectedCalendars.has(cal.id) ? cal.color : 'transparent' }}
                >
                  {selectedCalendars.has(cal.id) && <Check className="w-3 h-3 text-[#050505] stroke-[3]" />}
                </div>
                <span className="text-[13px] font-medium text-white/70 group-hover:text-white transition-colors select-none">{cal.label}</span>
                <input type="checkbox" checked={selectedCalendars.has(cal.id)} onChange={() => toggleCalendar(cal.id)} className="hidden" />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 p-8 pt-6">
        
        {/* Top Header / Nav */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-4">
            
            {/* View Toggles */}
            <div className="flex bg-[#111] border border-white/[0.06] rounded-full p-0.5 shadow-inner">
              <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}>Mes</button>
              <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === 'week' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}>Semana</button>
              <button onClick={() => setViewMode('agenda')} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === 'agenda' ? 'bg-white/[0.08] text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}>Agenda</button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 ml-2">
              <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 text-xs font-medium text-white/60 hover:text-white bg-[#111] border border-white/[0.06] rounded-full transition-colors shadow-inner">Hoy</button>
              <div className="flex items-center bg-[#111] border border-white/[0.06] rounded-full p-0.5 shadow-inner">
                <button onClick={prevPeriod} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/60"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={nextPeriod} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/60"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            <span className="ml-2 text-sm font-medium capitalize tracking-wide text-white/80">
              {getDynamicTitle()}
            </span>
          </div>
        </div>

        {/* View Container */}
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/50 backdrop-blur-[2px]">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
          </div>
        )}
        
        {viewMode === 'week' && renderTimeGridWeekView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'agenda' && renderAgendaView()}

      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsAdding(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} 
              className="relative bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] w-full max-w-2xl shadow-[0_0_120px_rgba(255,255,255,0.03)] overflow-visible flex flex-col"
            >
              {/* Subtle inner top highlight */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
              
              <form id="new-calendar-event-form" onSubmit={handleAddEvent} className="flex flex-col relative z-10">
                
                {/* Title Input */}
                <div className="px-8 py-8">
                  <input 
                    ref={titleInputRef}
                    type="text" 
                    required
                    value={newEvent.title}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="¿Qué vas a hacer?" 
                    className="w-full bg-transparent text-3xl font-light text-white placeholder:text-white/20 outline-none"
                  />
                </div>

                {/* Properties Grid */}
                <div className="px-6 pb-6">
                  <div className="bg-[#111111] border border-white/[0.06] shadow-inner rounded-[20px] flex flex-col">
                    
                    {/* Date */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] group hover:bg-white/[0.02] transition-colors rounded-t-[20px]">
                      <div className="flex items-center gap-4 text-white/50 group-hover:text-white/80 transition-colors">
                        <div className="w-8 h-8 rounded-[10px] bg-[#1a1a1a] border border-white/[0.04] flex items-center justify-center shadow-sm">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <span className="text-[14px] font-medium">Fecha del evento</span>
                      </div>
                      <div className="bg-[#050505] border border-white/10 rounded-xl px-3 py-1.5 hover:border-white/20 transition-all flex items-center shadow-sm">
                        <input 
                          type="date" 
                          required
                          value={newEvent.date}
                          onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                          className="bg-transparent text-[13px] font-medium text-white outline-none cursor-pointer [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                      </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] group hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4 text-white/50 group-hover:text-white/80 transition-colors">
                        <div className="w-8 h-8 rounded-[10px] bg-[#1a1a1a] border border-white/[0.04] flex items-center justify-center shadow-sm">
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-[14px] font-medium">Horario</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#050505] rounded-xl p-1 border border-white/10 shadow-sm">
                        <input 
                          type="time" 
                          required
                          value={newEvent.startTime}
                          onChange={e => setNewEvent({...newEvent, startTime: e.target.value})}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                          className="bg-transparent px-2 py-1 text-[13px] font-medium text-white outline-none cursor-pointer transition-colors [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                        <span className="text-white/20 text-xs">→</span>
                        <input 
                          type="time" 
                          required
                          value={newEvent.endTime}
                          onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                          onClick={(e) => e.currentTarget.showPicker?.()}
                          className="bg-transparent px-2 py-1 text-[13px] font-medium text-white outline-none cursor-pointer transition-colors [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                      </div>
                    </div>

                    {/* Calendar (Custom Dropdown) */}
                    <div className="relative flex items-center justify-between px-5 py-4 group hover:bg-white/[0.02] transition-colors rounded-b-[20px]">
                      <div className="flex items-center gap-4 text-white/50 group-hover:text-white/80 transition-colors">
                        <div className="w-8 h-8 rounded-[10px] bg-[#1a1a1a] border border-white/[0.04] flex items-center justify-center shadow-sm">
                          <CalendarPlus className="w-4 h-4" />
                        </div>
                        <span className="text-[14px] font-medium">Calendario</span>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setIsCalendarMenuOpen(!isCalendarMenuOpen)}
                        className="bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-[13px] font-medium text-white hover:border-white/30 transition-all flex items-center gap-3 shadow-sm min-w-[120px] justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getCalColor(newEvent.calendar).dot}`} />
                          {newEvent.calendar === 'andrevalleo13@gmail.com' ? 'Personal' : newEvent.calendar === 'Work' ? 'Trabajo' : 'Casa'}
                        </div>
                        <span className="text-[10px] text-white/30">▼</span>
                      </button>

                      <AnimatePresence>
                        {isCalendarMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsCalendarMenuOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: -5, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -5, scale: 0.98 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                              className="absolute right-5 top-[85%] mt-1 w-48 bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col p-1.5"
                            >
                              {[
                                { id: 'andrevalleo13@gmail.com', label: 'Personal', color: '#b8b8b8' },
                                { id: 'Work', label: 'Trabajo', color: '#888888' },
                                { id: 'Home', label: 'Casa', color: '#5f5f5f' }
                              ].map(cal => (
                                <button
                                  key={cal.id}
                                  type="button"
                                  onClick={() => {
                                    setNewEvent({...newEvent, calendar: cal.id});
                                    setIsCalendarMenuOpen(false);
                                  }}
                                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors text-left"
                                >
                                  <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: cal.color }} />
                                  <span className="text-[13px] font-medium text-white/90">{cal.label}</span>
                                  {newEvent.calendar === cal.id && <Check className="w-3.5 h-3.5 text-white/50 ml-auto" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-5 bg-[#080808]/50 flex items-center justify-between border-t border-white/[0.04]">
                  <div className="flex items-center gap-4 text-[12px] font-medium text-white/30">
                    <span className="flex items-center gap-1.5"><kbd className="font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/10 shadow-sm">esc</kbd> cancelar</span>
                    <span className="flex items-center gap-1.5"><kbd className="font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/10 shadow-sm">⌘ ↵</kbd> guardar</span>
                  </div>
                  
                  <button 
                    type="submit"
                    className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center gap-2"
                  >
                    Crear Evento <span className="text-black/30 font-mono text-[10px]">↵</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Details Popover */}
      <AnimatePresence>
        {activeEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveEvent(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ duration: 0.15, ease: "easeOut" }}
              className="relative bg-[#1c1c1c] border border-[#333] rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-medium text-white mb-1">{activeEvent.title}</h3>
                  <p className="text-sm text-white/50">{format(parseEventDate(activeEvent.start), 'EEEE, d MMMM yyyy', { locale: es })}</p>
                </div>
                <button onClick={() => setActiveEvent(null)} className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Clock className="w-4 h-4 opacity-50" />
                  {format(parseEventDate(activeEvent.start), 'HH:mm')} - {format(parseEventDate(activeEvent.end), 'HH:mm')}
                </div>
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className={`w-3 h-3 rounded-full ${getCalColor(activeEvent.calendar).dot}`} />
                  {activeEvent.calendar === 'andrevalleo13@gmail.com' ? 'Personal' : activeEvent.calendar === 'Work' ? 'Trabajo' : 'Casa'}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06] flex justify-end">
                <button 
                  onClick={() => handleDelete(activeEvent.id, activeEvent.calendar)}
                  className="flex items-center gap-2 rounded-lg bg-white/[0.045] px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.075] hover:text-white/80"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar Evento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
