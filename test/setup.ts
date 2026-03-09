import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

import { URLSearchParams } from "node:url";

globalThis.URLSearchParams = URLSearchParams as any;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(async () => {
  const ResizeObserverMock = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});
