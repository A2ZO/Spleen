"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useTypedBeforeHydration } from "@/lib/typed-before-hydration";

/*
 * Field on the page background (pill-shaped input and select, rounded textarea). Its border is `border-field` (3:1, WCAG 1.4.11);
 * focus keeps the global lilac ring and turns the border lilac. Disabled: muted ink on
 * `surface-alt` with the quiet border.
 */
const control =
  "w-full border border-border-field bg-bg px-[18px] py-2 text-[15px] text-fg placeholder:text-fg-muted focus:border-accent aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-alt disabled:text-fg-muted";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Positive feedback shown instead of the hint (e.g. "this username is free"). */
  success?: ReactNode;
}

/** Label, hint and error wired to the control with ids (screen readers announce them). */
function FieldShell({
  id,
  label,
  hint,
  error,
  success,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : success ? (
        <p id={`${id}-msg`} aria-live="polite" className="text-sm text-star">
          {success}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  success,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"input">, "ref">) {
  const id = useId();
  const ref = useTypedBeforeHydration(props.value, props.onChange);
  const described = error || success || hint ? `${id}-msg` : undefined;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} success={success}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={cn(control, "min-h-11 rounded-full", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  ...props
}: FieldProps & Omit<ComponentProps<"textarea">, "ref">) {
  const id = useId();
  const ref = useTypedBeforeHydration(props.value, props.onChange);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(control, "min-h-24 rounded-2xl py-3", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: FieldProps & ComponentProps<"select">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      {/* Own chevron: the native one sits against the pill's edge. */}
      <div className="relative">
        <select
          id={id}
          aria-describedby={hint ? `${id}-msg` : undefined}
          className={cn(control, "min-h-11 appearance-none rounded-full pr-12", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-[18px] size-4 -translate-y-1/2 text-fg-muted"
        />
      </div>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: { label: ReactNode; hint?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-5 shrink-0 accent-accent"
        {...props}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-fg-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Form-level message (after a submit). */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return tone === "error" ? (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  ) : (
    <p role="status" className="text-sm text-star">
      {children}
    </p>
  );
}
