import { toast } from "sonner";

export const showToast = {
  /** Success toast with Quetzal Green glow, auto-dismisses at 4s */
  success(message: string) {
    toast(message, {
      duration: 4000,
      className: "quetzal-glow",
    });
  },

  /** Error toast that persists until manually dismissed */
  error(message: string) {
    toast.error(message, {
      duration: Infinity,
    });
  },

  /** Info toast, auto-dismisses at 5s */
  info(message: string) {
    toast(message, {
      duration: 5000,
    });
  },

  /** Toast with undo action button */
  undo(message: string, onUndo: () => void) {
    toast(message, {
      action: {
        label: "Undo",
        onClick: onUndo,
      },
      duration: 8000,
    });
  },
};
