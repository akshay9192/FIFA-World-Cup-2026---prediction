import React, { useEffect, useState } from 'react';
import Accuracy from './pages/Accuracy';
import About from './pages/About';
import Bias from './pages/Bias';
import ReplayServiceStatus from './components/ReplayServiceStatus';
import { ReplayDataProvider } from './data/ReplayDataContext';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Predictions from './pages/Predictions';
import { HashRouter, Link, useRouter } from './router';

const links = [
  ['/', 'Atlas'], ['/predictions', 'Predictions'], ['/accuracy', 'Accuracy'],
  ['/bias', 'Bias lab'], ['/about', 'Method'],
];

function Navigation() {
  const [open, setOpen] = useState(false);
  const { path } = useRouter();
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="site-header">
      <div className="page-shell nav-frame">
        <Link to="/" className="wordmark" aria-label="Tournament Atlas home">
          <span aria-hidden="true">26</span>
          <strong>The Tournament Atlas<small>World Cup prediction study</small></strong>
        </Link>
        <button type="button" className="menu-button" aria-expanded={open} aria-controls="primary-navigation" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true">{open ? 'Close' : 'Menu'}</span>
        </button>
        <nav id="primary-navigation" aria-label="Primary navigation" className={open ? 'is-open' : ''}>
          {links.map(([to, label], index) => (
            <Link key={to} to={to} aria-current={path === to ? 'page' : undefined}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function App({ fallbackData }) {
  return (
    <ReplayDataProvider fallbackData={fallbackData}>
      <HashRouter><AppLayout /></HashRouter>
    </ReplayDataProvider>
  );
}

function AppLayout() {
  const { path } = useRouter();
  const pages = {
    '/': <Dashboard />, '/predictions': <Predictions />, '/accuracy': <Accuracy />,
    '/bias': <Bias />, '/about': <About />,
  };
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Navigation />
      <ReplayServiceStatus />
      <main id="main-content" tabIndex="-1">{pages[path] || <NotFound />}</main>
      <footer className="site-footer">
        <div className="page-shell footer-grid">
          <div><span className="footer-number">26</span><p>The Tournament Atlas</p></div>
          <p>An independent experimental fan project. Not affiliated with or endorsed by FIFA. No official marks or tournament artwork are used.</p>
          <div><Link to="/about">Method & limitations</Link><a href="#main-content">Back to top ↑</a></div>
        </div>
      </footer>
    </div>
  );
}
