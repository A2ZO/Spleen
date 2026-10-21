"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { FormMessage, TextField } from "@/components/ui/Field";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type Status = "idle" | "sending" | "sent" | "error" | "rateLimited";

export function SignInForm({
  locale,
  googleEnabled,
  devHint,
  linkError,
  className,
}: {
  locale: string;
  googleEnabled: boolean;
  devHint: boolean;
  linkError: boolean;
  className?: string;
}) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // After signing in, /welcome sends members to onboarding or to their shelf.
  const callbackURL = `/${locale}/welcome`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL,
      errorCallbackURL: `/${locale}/sign-in?error=link`,
      metadata: { locale },
    });
    setStatus(error ? (error.status === 429 ? "rateLimited" : "error") : "sent");
  }

  if (status === "sent") {
    return (
      <div className={cn("space-y-4", className)} role="status">
        <h2 className="text-2xl font-semibold">{t("sentTitle")}</h2>
        <p className="text-fg-muted">{t("sentBody", { email })}</p>
        {devHint && <p className="font-mono text-xs text-star">{t("devHint")}</p>}
        <Button variant="ghost" onClick={() => setStatus("idle")}>
          {t("otherEmail")}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {linkError && status === "idle" && <FormMessage tone="error">{t("linkExpired")}</FormMessage>}
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          label={t("emailLabel")}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {status === "error" && <FormMessage tone="error">{t("error")}</FormMessage>}
        {status === "rateLimited" && <FormMessage tone="error">{t("rateLimited")}</FormMessage>}
        <Button type="submit" className="w-full" disabled={status === "sending"}>
          {status === "sending" ? t("sending") : t("submit")}
        </Button>
      </form>
      {googleEnabled && (
        <>
          <p className="flex items-center gap-3 text-xs tracking-widest text-fg-muted uppercase before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            {t("or")}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}
          >
            {t("google")}
          </Button>
        </>
      )}
    </div>
  );
}
