/** Unread count on the bell (header and tab bar); the text equivalent is in the link's name. */
export function NotificationBadge({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[0.65rem] leading-none text-accent-fg"
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
}
