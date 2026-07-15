// Shared test setup, wired in via vitest.config.ts `setupFiles`.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// We don't use vitest globals, so react-testing-library's automatic cleanup
// (which needs a global afterEach at import time) doesn't kick in — register
// it explicitly.
afterEach(cleanup);
