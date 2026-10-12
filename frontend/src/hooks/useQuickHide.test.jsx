import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, render, fireEvent, act } from "@testing-library/react";
import { useDoubleEscape, DOUBLE_ESCAPE_WINDOW_MS } from "./useQuickHide";
import { useModalA11y } from "./useModalA11y";

const pressEscape = (target = window, init = {}) => {
  fireEvent.keyDown(target, { key: "Escape", ...init });
};

describe("useDoubleEscape", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not trigger on a single Escape", () => {
    const onTrigger = vi.fn();
    renderHook(() => useDoubleEscape(onTrigger));
    pressEscape();
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("triggers on two Escapes within the window", () => {
    const onTrigger = vi.fn();
    renderHook(() => useDoubleEscape(onTrigger));
    pressEscape();
    act(() => vi.advanceTimersByTime(DOUBLE_ESCAPE_WINDOW_MS - 100));
    pressEscape();
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does not trigger when the presses are too far apart", () => {
    const onTrigger = vi.fn();
    renderHook(() => useDoubleEscape(onTrigger));
    pressEscape();
    act(() => vi.advanceTimersByTime(DOUBLE_ESCAPE_WINDOW_MS + 50));
    pressEscape();
    expect(onTrigger).not.toHaveBeenCalled();
    // ...but that second press arms a new window.
    act(() => vi.advanceTimersByTime(200));
    pressEscape();
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape presses that were already handled (defaultPrevented)", () => {
    const onTrigger = vi.fn();
    renderHook(() => useDoubleEscape(onTrigger));
    const consume = (e) => e.preventDefault();
    window.addEventListener("keydown", consume, true);
    pressEscape();
    pressEscape();
    window.removeEventListener("keydown", consume, true);
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("ignores auto-repeat events from a held key", () => {
    const onTrigger = vi.fn();
    renderHook(() => useDoubleEscape(onTrigger));
    pressEscape();
    pressEscape(window, { repeat: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const onTrigger = vi.fn();
    renderHook(() => useDoubleEscape(onTrigger));
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("removes its listener on unmount", () => {
    const onTrigger = vi.fn();
    const { unmount } = renderHook(() => useDoubleEscape(onTrigger));
    unmount();
    pressEscape();
    pressEscape();
    expect(onTrigger).not.toHaveBeenCalled();
  });
});

describe("useDoubleEscape with an open modal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function Harness({ onQuickExit, onClose, open }) {
    useDoubleEscape(onQuickExit);
    const ref = useModalA11y(open, onClose);
    return open ? (
      <div ref={ref} tabIndex={-1} role="dialog">
        <button type="button">ok</button>
      </div>
    ) : null;
  }

  it("closing a modal with Escape does not count toward the quick exit", () => {
    const onQuickExit = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<Harness open onQuickExit={onQuickExit} onClose={onClose} />);

    pressEscape(document.activeElement ?? window); // consumed by the modal
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Harness open={false} onQuickExit={onQuickExit} onClose={onClose} />);

    pressEscape(); // first "real" press only arms the shortcut
    expect(onQuickExit).not.toHaveBeenCalled();

    pressEscape();
    expect(onQuickExit).toHaveBeenCalledTimes(1);
  });
});
