import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { showToast } from "../../../src/lib/toast";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("showToast", () => {
  it("success calls toast with Quetzal Green class, Check icon, and 4s duration", () => {
    showToast.success("Saved!");
    expect(toast).toHaveBeenCalledWith(
      "Saved!",
      expect.objectContaining({
        duration: 4000,
        className: "quetzal-glow",
        icon: expect.anything(),
      })
    );
  });

  it("error calls toast.error that persists until dismissed", () => {
    showToast.error("Something failed");
    expect(toast.error).toHaveBeenCalledWith(
      "Something failed",
      expect.objectContaining({
        duration: Infinity,
      })
    );
  });

  it("info calls toast with 5s auto-dismiss", () => {
    showToast.info("FYI");
    expect(toast).toHaveBeenCalledWith(
      "FYI",
      expect.objectContaining({
        duration: 5000,
      })
    );
  });

  it("undo calls toast with action button that invokes callback", () => {
    const onUndo = vi.fn();
    showToast.undo("Deleted", onUndo);
    expect(toast).toHaveBeenCalledWith(
      "Deleted",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: onUndo,
        }),
      })
    );
  });
});
