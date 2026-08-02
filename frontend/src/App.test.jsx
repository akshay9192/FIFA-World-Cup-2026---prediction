import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { clearApiCache } from './api';
import { clearReplaySession } from './data/ReplayDataContext';

const prediction = {
  match_id: 104, team_a: 'Spain', team_b: 'Argentina', match_date: '2026-07-19T12:00:00',
  venue: 'New York New Jersey Stadium', stage: 'final', group_name: null,
  predicted_score_a: 1.4, predicted_score_b: 1.2, predicted_winner: 'Spain',
  win_prob_a: 0.42, draw_prob: 0.29, win_prob_b: 0.29, confidence_score: 0.13,
  most_likely_scoreline: '1-1', feature_contributions: {}, actual_score_a: 1,
  actual_score_b: 0, actual_winner: 'Spain', result_source: 'verified result', result_note: 'After extra time',
};
const team = { id: 1, name: 'Spain', group_name: 'H', confederation: 'UEFA', strength_rank: 2 };
const secondTeam = { id: 2, name: 'Argentina', group_name: 'H', confederation: 'CONMEBOL', strength_rank: 3 };
const meta = {
  title: '2026 World Cup replay dataset', datetime_note: 'Seed times are date markers.',
  last_verified_utc: '2026-07-31T00:00:00Z', model: { limitations: 'Experimental inputs.', method: 'Poisson model.' },
};
const health = { status: 'ok', database: { matches: 1 } };
const accuracy = { total_predictions: 1, correct: 1, accuracy_percentage: 100, group_stage_accuracy: 0, knockout_accuracy: 100, history: [{ date: '2026-07-19', accuracy: 100, stage: 'final' }] };

beforeEach(() => {
  window.location.hash = '#/'; clearApiCache(); clearReplaySession(); global.fetch = jest.fn();
  window.matchMedia.mockImplementation((query) => ({ matches: false, media: query, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
});
afterEach(() => { jest.restoreAllMocks(); });

test('renders the atlas, keyboard-operable constellation, and mobile navigation', async () => {
  global.fetch.mockImplementation(liveResponse);
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('heading', { name: /Replay the whole field/i })).toBeInTheDocument();
  const teamButtons = await screen.findAllByRole('button', { name: 'Spain, Group H' });
  fireEvent.focus(teamButtons[0]);
  expect(screen.getByRole('link', { name: /Trace match record/ })).toHaveAttribute('href', '#/predictions?team=Spain');
  fireEvent.keyDown(teamButtons[0], { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Argentina, Group H' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
  expect(screen.getByRole('navigation', { name: 'Primary navigation' }).parentElement).toHaveClass('is-open');
  fireEvent.click(screen.getByRole('link', { name: /Predictions/ }));
  expect(window.location.hash).toBe('#/predictions');
});

test('mobile menu locks the page, closes on Escape, and restores trigger focus', async () => {
  global.fetch.mockImplementation(liveResponse);
  render(<App fallbackData={null} />);
  const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
  fireEvent.click(trigger);
  expect(document.body).toHaveStyle({ overflow: 'hidden' });
  expect(screen.getByRole('navigation', { name: 'Primary navigation' }).parentElement).toHaveClass('is-open');
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(document.body.style.overflow).toBe('');
});

test('shows a useful retry state when the backend is unavailable', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Prediction engine unavailable');
  expect(screen.getByRole('button', { name: 'Retry loading data' })).toBeInTheDocument();
});

test('supports prediction routes, filtering, and API data', async () => {
  window.location.hash = '#/predictions?team=Spain'; global.fetch.mockImplementation(liveResponse);
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('heading', { name: /Every match, three possible stories/i })).toBeInTheDocument();
  expect(await screen.findByText('✓ Matched outcome')).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toHaveValue('Spain');
  expect(screen.getByText(/Showing/).parentElement).toHaveTextContent('Showing 1 of 1 matches');
});

test('supports direct accuracy routes and exposes a chart alternative', async () => {
  window.location.hash = '#/accuracy'; global.fetch.mockImplementation(liveResponse);
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('heading', { name: /Where the model held its line/i })).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: 'Running model outcome accuracy' })).toHaveAccessibleDescription(/ending at/);
});

test('supports direct bias routes and explains limitations', async () => {
  window.location.hash = '#/bias';
  global.fetch.mockImplementation((url) => url.endsWith('/bias') ? Promise.resolve(ok({ user_correct: 0, model_correct: 0, completed_comparisons: 0 })) : liveResponse(url));
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('heading', { name: /Your instinct, under floodlights/i })).toBeInTheDocument();
  expect(await screen.findByText('Spain vs Argentina', { exact: false })).toBeInTheDocument();
  expect(screen.getByText(/cannot support a fairness guarantee/i)).toBeInTheDocument();
});

test('renders the Match Not Found route', async () => {
  window.location.hash = '#/not-a-real-page'; global.fetch.mockImplementation(liveResponse); render(<App fallbackData={null} />);
  expect(screen.getByRole('heading', { name: /This route left the field/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Return to the atlas' })).toHaveAttribute('href', '#/');
  expect(await screen.findByLabelText('Prediction service telemetry')).toBeInTheDocument();
});

test('keeps hash navigation responsive while the backend is waking', async () => {
  const rejections = [];
  global.fetch.mockImplementation(() => new Promise((_resolve, reject) => rejections.push(reject)));
  const user = userEvent.setup(); render(<App fallbackData={null} />);
  expect(screen.getAllByRole('status')[0]).toHaveTextContent(/Warming up prediction engine/i);
  await user.click(screen.getByRole('link', { name: /Enter the predictions/i }));
  expect(window.location.hash).toBe('#/predictions');
  expect(screen.getByRole('heading', { name: /Every match, three possible stories/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(5);
  rejections.forEach((reject) => reject(new Error('offline')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Prediction engine unavailable');
});

test('retries a failed cold-start request and renders successful data', async () => {
  global.fetch.mockRejectedValue(new Error('offline')); const user = userEvent.setup();
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Prediction engine unavailable');
  global.fetch.mockImplementation(liveResponse);
  await user.click(screen.getByRole('button', { name: 'Retry loading data' }));
  expect((await screen.findAllByText('Spain')).length).toBeGreaterThan(0);
  expect(global.fetch).toHaveBeenCalledTimes(10);
});

test('reuses successful session data immediately on refresh', async () => {
  global.fetch.mockImplementation(liveResponse);
  const first = render(<App fallbackData={null} />);
  expect((await screen.findAllByText('Spain')).length).toBeGreaterThan(0);
  await waitFor(() => expect(window.sessionStorage.length).toBe(1)); first.unmount(); clearApiCache();
  const rejections = []; global.fetch.mockImplementation(() => new Promise((_resolve, reject) => rejections.push(reject)));
  render(<App fallbackData={null} />);
  expect(screen.getAllByText('Spain').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('status')[0]).toHaveTextContent(/Warming up prediction engine/i);
  rejections.forEach((reject) => reject(new Error('offline')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Showing saved replay data');
});

test('renders bundled fallback data while the live service is unavailable', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));
  render(<App fallbackData={{ health, meta, predictions: [prediction], accuracy, teams: [team] }} />);
  expect(screen.getAllByText('Spain').length).toBeGreaterThan(0);
  expect(await screen.findByRole('alert')).toHaveTextContent('Showing saved replay data');
  expect(screen.getByRole('button', { name: 'Retry live service' })).toBeInTheDocument();
});

test('activates the reduced-motion mode without hiding atlas content', async () => {
  window.matchMedia.mockImplementation((query) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  global.fetch.mockImplementation(liveResponse);
  render(<App fallbackData={null} />);
  expect(await screen.findByRole('heading', { name: /Replay the whole field/i })).toBeInTheDocument();
  await waitFor(() => expect(document.documentElement).toHaveClass('reduced-motion'));
  expect(await screen.findByRole('img', { name: 'The 48-team Tournament Constellation' })).toBeInTheDocument();
});

function liveResponse(url) {
  if (url.endsWith('/health')) return Promise.resolve(ok(health));
  if (url.endsWith('/meta')) return Promise.resolve(ok(meta));
  if (url.endsWith('/predictions')) return Promise.resolve(ok([prediction]));
  if (url.endsWith('/accuracy')) return Promise.resolve(ok(accuracy));
  if (url.endsWith('/teams')) return Promise.resolve(ok([team, secondTeam]));
  return Promise.reject(new Error(`unexpected request: ${url}`));
}
function ok(payload) { return { ok: true, json: async () => payload }; }
