"use client";

import type { ApiErrorCode, UsernameStatus } from "@spleen/api";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { TextField } from "@/components/ui/Field";

const STATUS_ERROR = {
  invalid: "USERNAME_INVALID",
  reserved: "USERNAME_RESERVED",
  taken: "USERNAME_TAKEN",
} as const;

/** @username input with a debounced availability check against the API. */
export function UsernameField({
  label,
  defaultValue = "",
  serverError,
  check,
  current,
}: {
  label: string;
  defaultValue?: string;
  /** Error code returned by the last submit. */
  serverError?: ApiErrorCode | "unknown";
  check: (username: string) => Promise<UsernameStatus>;
  /** Current username (settings): no check while unchanged. */
  current?: string;
}) {
  const t = useTranslations("welcome");
  const te = useTranslations("errors");
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<UsernameStatus | null>(null);
  const [, startTransition] = useTransition();
  const normalized = value.trim().toLowerCase();

  useEffect(() => {
    if (normalized.length < 3 || normalized === current) return;
    const timer = setTimeout(() => {
      startTransition(async () => setStatus(await check(normalized)));
    }, 400);
    return () => clearTimeout(timer);
  }, [normalized, current, check]);

  const live = normalized.length >= 3 && normalized !== current ? status : null;
  const error =
    live && live !== "available"
      ? te(STATUS_ERROR[live])
      : serverError
        ? te(serverError)
        : undefined;

  return (
    <TextField
      label={label}
      name="username"
      required
      minLength={3}
      maxLength={30}
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setStatus(null);
      }}
      hint={t("usernameHint")}
      error={error}
      success={live === "available" ? t("available") : undefined}
    />
  );
}
