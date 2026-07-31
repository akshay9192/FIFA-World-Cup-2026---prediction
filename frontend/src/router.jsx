import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

function currentHashPath() {
  const path = window.location.hash.replace(/^#/, '');
  return path.startsWith('/') ? path : '/';
}

export function HashRouter({ children }) {
  const [path, setPath] = useState(currentHashPath);
  useEffect(() => {
    const onHashChange = () => setPath(currentHashPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const value = useMemo(() => ({
    path,
    navigate(to) {
      if (to === currentHashPath()) return;
      window.location.hash = to;
      setPath(to);
      window.scrollTo?.(0, 0);
    },
  }), [path]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside HashRouter');
  return value;
}

export function Link({ to, className = '', children, onClick, ...props }) {
  const { navigate } = useRouter();
  function follow(event) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;
    event.preventDefault();
    navigate(to);
  }
  return <a href={`#${to}`} className={className} onClick={follow} {...props}>{children}</a>;
}
