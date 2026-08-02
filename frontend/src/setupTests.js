import '@testing-library/jest-dom';

Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
});
window.scrollTo = jest.fn();
