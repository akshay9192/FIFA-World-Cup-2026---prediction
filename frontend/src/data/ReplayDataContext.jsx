import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, clearApiCache } from '../api';
import staticReplayData from '../fallback/replay-data.json';

const ReplayDataContext = createContext(null);
const SESSION_KEY = 'world-cup-replay-data:v1';

function readSessionData() {
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function storeSessionData(data) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // A storage quota or privacy setting should never break the replay.
  }
}

export function ReplayDataProvider({ children, fallbackData = staticReplayData }) {
  const initial = useMemo(() => readSessionData() || fallbackData, [fallbackData]);
  const [data, setData] = useState(initial);
  const [source, setSource] = useState(readSessionData() ? 'session' : fallbackData ? 'fallback' : 'none');
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(null);

  const load = useCallback(async ({ force = false } = {}) => {
    if (requestRef.current) return requestRef.current;
    if (force) clearApiCache();
    setRefreshing(true);
    setError('');
    const request = Promise.all([
      api('/health', { force }),
      api('/meta', { force }),
      api('/predictions', { force }),
      api('/accuracy', { force }),
      api('/teams', { force }),
    ])
      .then(([health, meta, predictions, accuracy, teams]) => {
        const next = { health, meta, predictions, accuracy, teams };
        setData(next);
        setSource('live');
        storeSessionData(next);
        return next;
      })
      .catch((requestError) => {
        setError(requestError.message);
        throw requestError;
      })
      .finally(() => {
        requestRef.current = null;
        setRefreshing(false);
      });
    requestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const retry = useCallback(() => load({ force: true }).catch(() => {}), [load]);
  const value = useMemo(() => ({
    data,
    error,
    loading: !data && refreshing,
    refreshing,
    retry,
    source,
  }), [data, error, refreshing, retry, source]);

  return (
    <ReplayDataContext.Provider value={value}>
      {children}
    </ReplayDataContext.Provider>
  );
}

export function useReplayData() {
  const value = useContext(ReplayDataContext);
  if (!value) {
    throw new Error('useReplayData must be used inside ReplayDataProvider');
  }
  return value;
}

export function clearReplaySession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable session storage in restricted browsers.
  }
}
