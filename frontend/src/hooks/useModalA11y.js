import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal behaviour: focuses the dialog, traps Tab focus, locks body scroll,
 * restores focus on close, and closes on Escape.
 *
 * Escape is handled in the capture phase and consumed (preventDefault +
 * stopImmediatePropagation) so global shortcuts such as the double-Escape quick
 * exit never see a press that only closed this dialog.
 */
export function useModalA11y(isOpen, onClose) {
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;
    modalRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll(FOCUSABLE);
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement && typeof previousActiveElement.focus === "function") {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  return modalRef;
}
