import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Command, LayoutDashboard, LogOut, Search, Terminal, UserRound, X, Plus, LogIn, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import NotificationsDropdown from './NotificationsDropdown';
import { Avatar, cn } from './ui';

const commands = [
  { id: 'dashboard', label: 'Open workspace', hint: 'Navigate to dashboard', icon: LayoutDashboard },
  { id: 'search', label: 'Search problems', hint: 'Find a coding challenge', icon: Search },
  { id: 'create', label: 'Create a room', hint: 'Start a collaborative session', icon: Plus },
  { id: 'join', label: 'Join a room', hint: 'Enter a room code', icon: LogIn },
  { id: 'profile', label: 'Open your profile', hint: 'View your activity and stats', icon: UserRound }
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const filteredCommands = useMemo(() => commands.filter((command) =>
    `${command.label} ${command.hint}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [query]);

  useEffect(() => setActiveIndex(0), [query]);

  const openPalette = () => {
    setQuery('');
    setPaletteOpen(true);
  };

  const runCommand = (id) => {
    setPaletteOpen(false);
    setQuery('');
    if (id === 'dashboard') navigate('/');
    if (id === 'profile' && user?.username) navigate(`/profile/${user.username}`);
    if (id === 'search') {
      if (location.pathname !== '/') navigate('/');
      window.setTimeout(() => document.getElementById('problem-search')?.focus(), 120);
    }
    if (id === 'create' || id === 'join') {
      if (location.pathname !== '/') navigate('/');
      window.setTimeout(() => window.dispatchEvent(new CustomEvent(`leettogether:${id}-room`)), 140);
    }
  };

  const handlePaletteKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredCommands.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && filteredCommands[activeIndex]) runCommand(filteredCommands[activeIndex].id);
  };

  if (!user) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-2xl">
        <div className="page-shell flex h-[68px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-8">
            <Link to="/" className="group flex flex-shrink-0 items-center gap-2.5" aria-label="LeetTogether home">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#9C85FF] to-[#6945F5] text-white shadow-lg shadow-violet-950/40 transition group-hover:rotate-[-4deg]">
                <Terminal className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-white">Leet<span className="text-violet-300">Together</span></span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
              <Link to="/" className={cn('rounded-lg px-3 py-2 text-sm transition', location.pathname === '/' ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200')}>
                Workspace
              </Link>
              <Link to={user?.username ? `/profile/${user.username}` : '/'} className={cn('rounded-lg px-3 py-2 text-sm transition', location.pathname.startsWith('/profile') ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200')}>
                Activity
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={openPalette} className="group hidden h-9 w-[210px] items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-left text-xs text-zinc-500 transition hover:border-white/[0.12] hover:bg-white/[0.05] sm:flex" aria-label="Open command palette">
              <span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Jump to…</span>
              <span className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"><Command className="h-3 w-3" /> K</span>
            </button>
            <button onClick={openPalette} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.06] hover:text-white sm:hidden" aria-label="Search and commands"><Search className="h-4 w-4" /></button>
            <NotificationsDropdown />
            <div className="relative">
              <button onClick={() => setDropdownOpen((open) => !open)} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-white/[0.05]" aria-expanded={dropdownOpen} aria-label="Open account menu">
                <Avatar src={user.avatar} name={user.username || 'Member'} size="sm" />
                <span className="hidden max-w-28 truncate text-sm font-medium text-zinc-300 sm:block">{user.username}</span>
              </button>
              {dropdownOpen && <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Close account menu" onClick={() => setDropdownOpen(false)} />
                <div className="surface-card premium-shadow absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl p-1.5">
                  <div className="border-b border-white/[0.06] px-3 py-3"><p className="text-[11px] text-zinc-500">Signed in as</p><p className="mt-0.5 truncate text-sm font-medium text-white">{user.username}</p></div>
                  <Link to={`/profile/${user.username}`} onClick={() => setDropdownOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.05]"><UserRound className="h-4 w-4 text-zinc-500" /> Your profile</Link>
                  <button onClick={() => { setDropdownOpen(false); logout(); navigate('/login'); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-400/10"><LogOut className="h-4 w-4" /> Sign out</button>
                </div>
              </>}
            </div>
          </div>
        </div>
      </header>

      <Dialog.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
        <AnimatePresence>
          {paletteOpen && <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm" />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.section initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.985 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className="surface-panel premium-shadow fixed inset-x-0 top-[12vh] z-[101] mx-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl">
                <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                <Dialog.Description className="sr-only">Search pages and quick actions. Use arrow keys to navigate and Enter to select.</Dialog.Description>
                <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
                  <Search className="h-4 w-4 flex-shrink-0 text-violet-300" />
                  <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handlePaletteKeyDown} placeholder="Search actions, pages, and problems…" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" aria-label="Search commands" />
                  <button onClick={() => setPaletteOpen(false)} className="rounded-md border border-white/[0.08] px-1.5 py-1 text-[10px] text-zinc-500 hover:text-white" aria-label="Close command palette"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="p-2">
                  <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[.15em] text-zinc-600">Quick actions</p>
                  {filteredCommands.length ? filteredCommands.map((item, index) => {
                    const Icon = item.icon;
                    return <button key={item.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => runCommand(item.id)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', activeIndex === index ? 'bg-violet-500/15 text-white' : 'text-zinc-300 hover:bg-white/[0.04]')}>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.045] text-zinc-400"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-xs text-zinc-500">{item.hint}</span></span>
                      {activeIndex === index && <ArrowUpRight className="h-4 w-4 text-violet-300" />}
                    </button>;
                  }) : <p className="px-3 py-8 text-center text-sm text-zinc-500">No matching actions</p>}
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[10px] text-zinc-600"><span>Navigate with ↑ ↓ and select with ↵</span><span>ESC to close</span></div>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
};

export default Navbar;
