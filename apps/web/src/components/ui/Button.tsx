import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * - `primary`: lilac, 5 px edge, 52 px tall (the page's main action).
 * - `secondary`: dark, 4 px edge.
 * - `ghost`: flat, for quiet actions.
 * - `ink` / `on-accent`: laid on a lilac block (dark button, translucent outlined button).
 */
type Variant = "primary" | "secondary" | "ghost" | "ink" | "on-accent";
type Size = "md" | "sm" | "icon" | "icon-lg";

/*
 * Disabled: flat (no edge, no shadow, no press), muted ink on `surface-alt`, so it never
 * looks clickable.
 * Pressing sinks the button onto its edge (translateY by the edge depth) and drops the edge
 * from the shadow. Only transform is animated; the shadow switches at once. The press goes
 * down with ease-out (`active:`), the release comes back up with the spring easing.
 */
const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-transform duration-150 ease-spring select-none active:ease-out disabled:pointer-events-none disabled:translate-y-0 disabled:border-transparent disabled:bg-surface-alt disabled:text-fg-muted disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:translate-y-0 aria-disabled:border-transparent aria-disabled:bg-surface-alt aria-disabled:text-fg-muted aria-disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-button-accent hover:bg-accent-hover active:translate-y-[5px] active:shadow-button-accent-pressed",
  secondary:
    "border border-border-strong bg-surface-raised text-fg shadow-button hover:border-fg-muted active:translate-y-[4px] active:shadow-button-pressed",
  ghost: "text-fg-muted hover:bg-surface-raised hover:text-fg",
  ink: "on-accent bg-accent-fg text-fg shadow-button-ink active:translate-y-[5px] active:shadow-button-on-accent-pressed",
  "on-accent":
    "on-accent border-2 border-accent-fg bg-white/28 text-accent-fg shadow-button-on-accent hover:bg-white/40 active:translate-y-[5px] active:shadow-button-on-accent-pressed",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-[15px]",
  sm: "min-h-11 px-4 text-sm",
  icon: "size-11",
  "icon-lg": "size-13",
};

/** The main action is 52 px tall; everything else keeps a 44 px target. */
function sizeClasses(variant: Variant, size: Size) {
  if (size === "md" && (variant === "primary" || variant === "ink" || variant === "on-accent")) {
    return "min-h-13 px-6 text-[17px]";
  }
  return sizes[size];
}

export interface ButtonStyle {
  variant?: Variant;
  size?: Size;
}

export function buttonClasses(variant: Variant = "primary", className?: string, size: Size = "md") {
  return cn(base, variants[variant], sizeClasses(variant, size), className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return <button type={type} className={buttonClasses(variant, className, size)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClasses(variant, className, size)} {...props} />;
}
