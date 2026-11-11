"use client";

import { isApiErrorCode, type ApiErrorCode } from "@spleen/api/errors";
import { useNavigate } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { squareImage } from "@/lib/resize-image";

export function AvatarForm({
  avatarUrl,
  displayName,
  seed,
}: {
  avatarUrl: string | null;
  displayName: string;
  seed: string;
}) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const router = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  async function send(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/avatar", init);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: unknown };
        setError(isApiErrorCode(body.error) ? body.error : "unknown");
        return;
      }
      router.refresh();
    } catch {
      setError("unknown");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    let image: Blob;
    try {
      image = await squareImage(file);
    } catch {
      setError("AVATAR_TYPE");
      return;
    }
    const body = new FormData();
    body.set("file", image, "avatar");
    await send({ method: "POST", body });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={displayName} seed={seed} src={avatarUrl} className="size-20 text-2xl" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label
            className={buttonClasses(
              "outline",
              busy ? "pointer-events-none opacity-50" : "cursor-pointer focus-within:border-star",
            )}
          >
            {busy ? t("avatarUploading") : t("avatarChange")}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {avatarUrl && (
            <Button variant="ghost" disabled={busy} onClick={() => send({ method: "DELETE" })}>
              {t("avatarRemove")}
            </Button>
          )}
        </div>
        <p className="text-sm text-fg-muted">{t("avatarHint")}</p>
        {error && <FormMessage tone="error">{te(error)}</FormMessage>}
      </div>
    </div>
  );
}
