"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 300;

/**
 * A figure that counts up to its value when it scrolls into view. The real value is in the
 * HTML (screen readers, no JavaScript) and the visible digits always start at that value:
 * a figure already on screen when the page loads never moves (it would flash 0 first), and
 * nothing moves with reduced motion. Its width is reserved, so counting shifts nothing.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const [target, setTarget] = useState(value);
  if (target !== value) {
    setTarget(value);
    setShown(value);
  }

  useEffect(() => {
    const node = ref.current;
    if (!node || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    let first = true;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      // The first callback reports the state at mount: already visible → stay still, for good.
      if (first) {
        first = false;
        if (visible) observer.disconnect();
        return;
      }
      if (!visible) return;
      observer.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION);
        const eased = 1 - (1 - progress) ** 3;
        setShown(Math.round(value * eased));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      setShown(0);
      frame = requestAnimationFrame(step);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <>
      <span className="sr-only">{value}</span>
      <span
        ref={ref}
        aria-hidden="true"
        data-count-up
        className={className}
        style={{ display: "inline-block", minWidth: `${String(value).length}ch` }}
      >
        {shown}
      </span>
    </>
  );
}
