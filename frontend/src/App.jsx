import React, { useState } from 'react';
import Accuracy from './pages/Accuracy';
import About from './pages/About';
import Bias from './pages/Bias';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Predictions from './pages/Predictions';
import { HashRouter, Link, useRouter } from './router';

const links = [
  ['/', 'Replay'],
  ['/predictions', 'Matches'],
  ['/accuracy', 'Accuracy'],
  ['/bias', 'Your prediction'],
  ['/about', 'Model & data'],
];

function Navigation() {
  const [open, setOpen] = useState(false);
  const { path } = useRouter();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/95 backdrop-blur">
      <div className="page-shell flex min-h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span aria-hidden="true" className="brand-mark">26</span>
          <span>
            <strong className="block text-sm tracking-wide text-white sm:text-base">World Cup Replay</strong>
            <span className="block text-[10px] uppercase tracking-[0.22em] text-mint-300">Model vs reality</span>
          </span>
        </Link>
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/15 text-xl font-semibold md:hidden"
          aria-expanded={open}
          aria-controls="primary-navigation"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? '×' : '☰'}</span>
        </button>
        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-16 flex-col gap-1 border-b border-white/10 bg-ink-950 p-4 md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0`}
        >
          {links.map(([to, label]) => (
            <Link key={to} to={to} className={`nav-link ${path === to ? 'nav-link-active' : ''}`} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
}

function AppLayout() {
  const { path } = useRouter();
  const pages = {
    '/': <Dashboard />,
    '/predictions': <Predictions />,
    '/accuracy': <Accuracy />,
    '/bias': <Bias />,
    '/about': <About />,
  };
  return (
      <div className="min-h-screen bg-ink-950 text-slate-100">
        <Navigation />
        <main>{pages[path] || <NotFound />}</main>
        <footer className="border-t border-white/10">
          <div className="page-shell py-8 text-sm leading-6 text-slate-400">
            Independent experimental fan project. Not affiliated with or endorsed by FIFA. No official logos or
            tournament artwork are used.
          </div>
        </footer>
      </div>
  );
}
