"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useTypedBeforeHydration } from "@/lib/typed-before-hydration";

const control =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-fg placeholder:text-fg-muted/70 focus:border-star focus:outline-none aria-[invalid=true]:border-danger";

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
        className={cn(control, className)}
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
        className={cn(control, "min-h-24", className)}
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
      <select
        id={id}
        aria-describedby={hint ? `${id}-msg` : undefined}
        className={cn(control, className)}
        {...props}
      >
        {children}
      </select>
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
        className="mt-1 size-4 shrink-0 accent-accent"
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
