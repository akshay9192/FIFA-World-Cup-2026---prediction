import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

function currentHashLocation() {
  const hash = window.location.hash.replace(/^#/, '');
  const value = hash.startsWith('/') ? hash : '/';
  const [path, search = ''] = value.split('?');
  return { path, search };
}

export function HashRouter({ children }) {
  const [location, setLocation] = useState(currentHashLocation);
  useEffect(() => {
    const onHashChange = () => setLocation(currentHashLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const value = useMemo(() => ({
    ...location,
    navigate(to) {
      const current = `${currentHashLocation().path}${currentHashLocation().search ? `?${currentHashLocation().search}` : ''}`;
      if (to === current) return;
      window.location.hash = to;
      setLocation(currentHashLocation());
      window.scrollTo?.(0, 0);
    },
  }), [location]);
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
