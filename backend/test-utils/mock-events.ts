/**
 * Shared mock factory for @ai-learning-hub/events.
 *
 * Story 3.1.2, Task 2: Extract duplicated events mock block
 * found in 4+ handler test files.
 *
 * Pattern matches mockMiddlewareModule() — returns a plain object
 * with mock functions created inside the factory.
 */
import { vi } from "vitest";

/**
 * Creates a vi.mock factory for @ai-learning-hub/events.
 *
 * Usage:
 * ```ts
 * const mockEmitEvent = vi.fn();
 * vi.mock("@ai-learning-hub/events", () =>
 *   mockEventsModule({ emitEvent: (...args: unknown[]) => mockEmitEvent(...args) })
 * );
 * ```
 *
 * Callers who need assertion access to `emitEvent` should declare
 * `const mockEmitEvent = vi.fn()` before the `vi.mock()` call and
 * pass it via `mockFns` (vi.mock hoisting constraint).
 */
export function mockEventsModule(
  mockFns: Record<string, (...args: unknown[]) => unknown> = {}
): Record<string, unknown> {
  return {
    emitEvent: vi.fn(),
    getDefaultClient: () => ({}),
    requireEventBus: () => ({ busName: "test-event-bus", ebClient: {} }),
    SAVES_EVENT_SOURCE: "ai-learning-hub.saves",
    ...mockFns,
  };
}
