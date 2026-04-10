import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// PointerEvent polyfill for jsdom (which only has MouseEvent)
class MockPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;

  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    this.pointerId = params.pointerId ?? 0;
    this.pointerType = params.pointerType ?? "mouse";
    this.isPrimary = params.isPrimary ?? true;
  }
}

// @ts-expect-error -- overriding global for jsdom
globalThis.PointerEvent = MockPointerEvent;

// Mock pointer capture methods on Element
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);

// Mock Firebase firestore operations
vi.mock("@/lib/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firestore")>();
  return {
    ...actual,
    updateIdea: vi.fn().mockResolvedValue(undefined),
    deleteIdea: vi.fn().mockResolvedValue(undefined),
    archiveIdea: vi.fn().mockResolvedValue(undefined),
    restoreIdea: vi.fn().mockResolvedValue(undefined),
    reorderIdeas: vi.fn().mockResolvedValue(undefined),
    subscribeToTagColors: vi.fn().mockReturnValue(() => {}),
    setTagColor: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock react-markdown (ESM-only, problematic in jsdom)
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => children,
}));

vi.mock("remark-gfm", () => ({
  default: () => {},
}));

// Mock firebase/firestore Timestamp
vi.mock("firebase/firestore", () => ({
  Timestamp: {
    now: () => ({ seconds: 1000, nanoseconds: 0, toDate: () => new Date() }),
    fromDate: (d: Date) => ({
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => d,
    }),
  },
}));

// Mock auth context
vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn().mockReturnValue({ user: { uid: "test-user" } }),
}));

// Mock theme context
vi.mock("@/lib/theme-context", () => ({
  useTheme: vi.fn().mockReturnValue({ resolvedTheme: "light" }),
}));

// Mock tag-color-context (avoids needing the full provider tree)
vi.mock("@/lib/tag-color-context", () => ({
  useTagColors: vi.fn().mockReturnValue({
    getColorClasses: () => "bg-gray-100 text-gray-800 border-gray-200",
    getColorKey: () => "gray",
    setTagColor: vi.fn(),
    getSwatchColor: () => "#6b7280",
    overrides: {},
  }),
  TagColorProvider: ({ children }: { children: React.ReactNode }) => children,
}));
