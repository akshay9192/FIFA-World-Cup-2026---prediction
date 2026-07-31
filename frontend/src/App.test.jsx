import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const prediction = {
  match_id: 104,
  team_a: 'Spain',
  team_b: 'Argentina',
  match_date: '2026-07-19T12:00:00',
  venue: 'New York New Jersey Stadium',
  stage: 'final',
  group_name: null,
  predicted_score_a: 1.4,
  predicted_score_b: 1.2,
  predicted_winner: 'Spain',
  win_prob_a: 0.42,
  draw_prob: 0.29,
  win_prob_b: 0.29,
  confidence_score: 0.13,
  most_likely_scoreline: '1-1',
  feature_contributions: {},
  actual_score_a: 1,
  actual_score_b: 0,
  actual_winner: 'Spain',
  result_source: 'FIFA verified historical result',
  result_note: 'After extra time',
};

const meta = {
  title: '2026 World Cup replay dataset',
  datetime_note: 'Seed times are date markers.',
  last_verified_utc: '2026-07-31T00:00:00Z',
  model: { limitations: 'Experimental inputs.' },
};
const accuracy = {
  total_predictions: 1,
  correct: 1,
  accuracy_percentage: 100,
  group_stage_accuracy: 0,
  knockout_accuracy: 100,
  history: [],
};

beforeEach(() => {
  window.location.hash = '#/';
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders a successful replay overview and mobile navigation', async () => {
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/meta')) return Promise.resolve(ok(meta));
    if (url.endsWith('/predictions')) return Promise.resolve(ok([prediction]));
    if (url.endsWith('/accuracy')) return Promise.resolve(ok(accuracy));
    return Promise.reject(new Error('unexpected request'));
  });
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByText('Replay 2026. Compare the model. Change the call.')).toBeInTheDocument();
  expect((await screen.findAllByText('Spain')).length).toBeGreaterThan(0);
  await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
  expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toHaveClass('flex');
  expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('href', '#/predictions');
  expect(screen.getByRole('link', { name: 'Accuracy' })).toHaveAttribute('href', '#/accuracy');
  expect(screen.getByRole('link', { name: 'Your prediction' })).toHaveAttribute('href', '#/bias');
  await user.click(screen.getByRole('link', { name: 'Matches' }));
  await waitFor(() => expect(window.location.hash).toBe('#/predictions'));
  expect(await screen.findByRole('heading', { name: 'Every match, replayed' })).toBeInTheDocument();
});

test('shows a useful retry state when the backend is unavailable', async () => {
  global.fetch.mockRejectedValue(new Error('offline'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Replay service unavailable');
  expect(screen.getByRole('button', { name: 'Retry loading data' })).toBeInTheDocument();
});

test('supports direct prediction routes and renders API data', async () => {
  window.location.hash = '#/predictions';
  global.fetch.mockResolvedValue(ok([prediction]));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Every match, replayed' })).toBeInTheDocument();
  expect(await screen.findByText('Matched outcome')).toBeInTheDocument();
  expect(screen.getByText('Showing 1 of 1 matches')).toBeInTheDocument();
});

test('supports direct accuracy routes', async () => {
  window.location.hash = '#/accuracy';
  global.fetch.mockImplementation((url) => (
    Promise.resolve(ok(url.endsWith('/accuracy') ? accuracy : [prediction]))
  ));
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Where the model got it right/ })).toBeInTheDocument();
  expect(await screen.findAllByText('100.0%')).toHaveLength(2);
});

test('supports direct bias routes', async () => {
  window.location.hash = '#/bias';
  global.fetch.mockImplementation((url) => (
    Promise.resolve(ok(url.endsWith('/bias')
      ? { user_correct: 0, model_correct: 0, completed_comparisons: 0 }
      : [prediction]))
  ));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Put your instinct against the model' })).toBeInTheDocument();
  expect(await screen.findByText('Spain vs Argentina', { exact: false })).toBeInTheDocument();
});

test('renders the friendly 404 route', async () => {
  window.location.hash = '#/not-a-real-page';
  render(<App />);
  await waitFor(() => expect(screen.getByText('That replay route does not exist.')).toBeInTheDocument());
});

function ok(payload) {
  return {
    ok: true,
    json: async () => payload,
  };
}
