import { useEffect, useRef } from "react";

// Runs `flush` when the page is being hidden or closed (tab switched away,
// app sent to the background, tab closed).
//
// Used by the delete flows: deleting a customer/supplier is deferred by a
// 5-second "Undo" window (a setTimeout). If the app was backgrounded or
// closed inside that window — very common on a phone, where the OS freezes
// timers of a backgrounded WebView — the timer never fired and the delete
// silently never happened. Flushing on hide commits it right away instead
// (a soft delete, so the owner can still restore it from the review sheet).
//
// `flush` may change every render; the latest one is always the one called.
export function useFlushOnHide(flush) {
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  useEffect(() => {
    const run = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") run();
    };
    window.addEventListener("pagehide", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
