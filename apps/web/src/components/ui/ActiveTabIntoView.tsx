"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls a horizontally scrolling tab list so its current tab (`aria-current`) is visible,
 * without moving the page. Renders an empty marker inside the list's parent.
 */
export function ActiveTabIntoView({ current }: { current: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const list = ref.current?.parentElement?.querySelector("ul");
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const listBox = list.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.left < listBox.left || box.right > listBox.right) {
      list.scrollLeft += box.left - listBox.left - (listBox.width - box.width) / 2;
    }
  }, [current]);

  return <span ref={ref} hidden />;
}
