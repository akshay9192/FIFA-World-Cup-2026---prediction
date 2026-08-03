import React, { useCallback, useEffect, useRef, useState } from 'react';
import Accuracy from './pages/Accuracy';
import About from './pages/About';
import Bias from './pages/Bias';
import ReplayServiceStatus from './components/ReplayServiceStatus';
import { ReplayDataProvider } from './data/ReplayDataContext';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Predictions from './pages/Predictions';
import { useMotionSystem } from './motion';
import { HashRouter, Link, useRouter } from './router';

const links = [['/', 'Atlas'], ['/predictions', 'Predictions'], ['/accuracy', 'Accuracy'], ['/bias', 'Bias lab'], ['/about', 'Method']];

function Navigation({ chapter }) {
  const [open, setOpen] = useState(false);
  const { path } = useRouter();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const close = useCallback((restore = false) => {
    setOpen(false);
    if (restore) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => panelRef.current?.querySelector('a')?.focus());
    const keydown = (event) => {
      if (event.key === 'Escape') close(true);
      if (event.key === 'Tab') {
        const items = [...panelRef.current.querySelectorAll('a,button')];
        const index = items.indexOf(document.activeElement);
        if (event.shiftKey && index === 0) { event.preventDefault(); items.at(-1)?.focus(); }
        if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { window.cancelAnimationFrame(focusFrame); document.body.style.overflow = previous; document.removeEventListener('keydown', keydown); };
  }, [close, open]);

  return (
    <header className="site-header">
      <div className="scroll-progress" aria-hidden="true"><i /></div>
      <div className="page-shell nav-frame">
        <Link to="/" className="wordmark" aria-label="Tournament Atlas home"><span aria-hidden="true">26</span><strong>Tournament Atlas<small>Prediction study</small></strong></Link>
        <div className="chapter-telemetry" aria-live="polite"><span>NOW READING</span><b>{chapter}</b></div>
        <button ref={triggerRef} type="button" className="menu-button" aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setOpen((value) => !value)}><i /><i /><span>{open ? 'Close' : 'Menu'}</span></button>
        <div className={`nav-overlay ${open ? 'is-open' : ''}`} aria-hidden={!open} onPointerDown={(event) => { if (event.target === event.currentTarget) close(true); }}>
          <nav ref={panelRef} id="primary-navigation" aria-label="Primary navigation">
            <div className="nav-panel-head"><span>TOURNAMENT INDEX</span><button type="button" onClick={() => close(true)} aria-label="Close navigation menu">×</button></div>
            {links.map(([to, label], index) => <Link key={to} to={to} aria-current={path === to ? 'page' : undefined}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><b>{label}</b><i aria-hidden="true">↗</i></Link>)}
            <p>Independent experimental fan project.<br />Not an official FIFA product.</p>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default function App({ fallbackData }) {
  return <ReplayDataProvider fallbackData={fallbackData}><HashRouter><AppLayout /></HashRouter></ReplayDataProvider>;
}

function AppLayout() {
  const { path } = useRouter();
  const [chapter, setChapter] = useState('Opening whistle');
  useMotionSystem(path, setChapter);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  const pages = { '/': <Dashboard />, '/predictions': <Predictions />, '/accuracy': <Accuracy />, '/bias': <Bias />, '/about': <About /> };
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Navigation chapter={path === '/' ? chapter : links.find(([route]) => route === path)?.[1] || 'Match not found'} />
      <ReplayServiceStatus />
      <main id="main-content" tabIndex="-1"><div key={path} className="route-transition">{pages[path] || <NotFound />}</div></main>
      <footer className="site-footer"><div className="page-shell footer-grid"><div><span className="footer-number">26</span><p>The Tournament Atlas</p></div><p>An independent experimental fan project. Not affiliated with or endorsed by FIFA. No official marks or tournament artwork are used.</p><div><Link to="/about">Method & limitations</Link><a href="#main-content">Back to top ↑</a></div></div></footer>
    </div>
  );
}
