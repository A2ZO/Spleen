"use client";

import type { ApiErrorCode, MoodRef, MyEntry, MyItemState } from "@spleen/api";
import {
  listenFormats,
  MOODS_PER_ENTRY_MAX,
  ratingToStars,
  suggestAlbumRating,
  type AudienceLang,
  type ListenFormat,
  type ListenTargetInput,
} from "@spleen/validators";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import {
  createEntryAction,
  createMoodAction,
  updateEntryAction,
} from "@/app/[locale]/listening/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { StarRating } from "@/components/ui/StarRating";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { flushScope, scopeOf } from "@/lib/use-undoable-delete";

export interface LogTrack {
  id: string;
  title: string;
  position: number;
}

interface LogDialogProps {
  target: ListenTargetInput;
  title: string;
  /** Null for a new listen. */
  entry: MyEntry | null;
  state: MyItemState;
  moods: MoodRef[];
  tracks: LogTrack[];
  onClose: () => void;
  onSaved: (state: MyItemState) => void;
  /** "Delete" on an existing listen (with "Undo", in the panel); `keyboard` = clicked with it. */
  onDelete: (entry: MyEntry, keyboard: boolean) => void;
}

/**
 * The "log" form, in a native modal dialog (focus trap, Escape and backdrop handled by the
 * browser): date (today in the member's time zone by default), rating, heart, relisten,
 * format, moods, optional review and optional track-by-track ratings.
 */
export function LogDialog({
  target,
  title,
  entry,
  state,
  moods: initialMoods,
  tracks,
  onClose,
  onSaved,
  onDelete,
}: LogDialogProps) {
  const t = useTranslations("listening");
  const tf = useTranslations("format");
  const tl = useTranslations("locale");
  const te = useTranslations("errors");
  const format = useFormatter();
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorCode | "unknown" | null>(null);

  const [listenedOn, setListenedOn] = useState(entry ? (entry.listenedOn ?? "") : state.today);
  const [rating, setRating] = useState(entry ? entry.rating : state.rating);
  const [liked, setLiked] = useState(entry ? entry.liked : state.liked);
  const [relisten, setRelisten] = useState(entry ? entry.relisten : state.listened);
  const [listenFormat, setListenFormat] = useState<ListenFormat | "">(entry?.format ?? "");
  const [moods, setMoods] = useState(initialMoods);
  const [moodIds, setMoodIds] = useState(entry?.moodIds ?? []);
  const [newMood, setNewMood] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewLang, setReviewLang] = useState<AudienceLang>(locale === "en" ? "en" : "fr");
  const [trackRatings, setTrackRatings] = useState(
    new Map((entry?.trackRatings ?? []).map((r) => [r.trackId, r.rating])),
  );

  // No cleanup: closing here would fire `close` (hence `onClose`) when Strict Mode replays
  // the effect; the dialog leaves the DOM with the component anyway.
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const suggestion = suggestAlbumRating([...trackRatings.values()]);
  const moodLabel = (mood: MoodRef) => (locale === "en" ? mood.labelEn : mood.labelFr);
  const undated = entry !== null && entry.listenedOn === null;

  const toggleMood = (id: string) =>
    setMoodIds((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < MOODS_PER_ENTRY_MAX
          ? [...ids, id]
          : ids,
    );

  const addMood = () =>
    startTransition(async () => {
      if (!newMood.trim()) return;
      const result = await createMoodAction(newMood);
      if (!result.mood) return setError(result.error ?? "unknown");
      const mood = result.mood;
      setMoods((list) => (list.some((m) => m.id === mood.id) ? list : [...list, mood]));
      setMoodIds((ids) =>
        ids.includes(mood.id) || ids.length >= MOODS_PER_ENTRY_MAX ? ids : [...ids, mood.id],
      );
      setNewMood("");
    });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = {
      rating,
      liked,
      relisten,
      format: listenFormat || null,
      moodIds,
      trackRatings: [...trackRatings].map(([trackId, value]) => ({ trackId, rating: value })),
    };
    startTransition(async () => {
      // A deletion of this record still waiting for its "Undo" leaves first (it would erase this).
      await flushScope(scopeOf(target));
      const result = entry
        ? await updateEntryAction(target, {
            id: entry.id,
            listenedOn: listenedOn || null,
            ...fields,
          })
        : await createEntryAction({
            target,
            listenedOn: listenedOn || undefined,
            ...fields,
            review: reviewBody.trim() ? { body: reviewBody, lang: reviewLang } : null,
          });
      if (result.state) onSaved(result.state);
      else setError(result.error ?? "unknown");
    });
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="log-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-card-sm border border-border bg-surface p-0 text-fg shadow-card backdrop:bg-bg/80 md:rounded-card"
    >
      <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
        <header>
          <p className="text-sm text-fg-muted">{t("prompt")}</p>
          <h2
            id="log-title"
            className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-balance"
          >
            {entry ? t("editTitle") : t("dialogTitle", { title })}
          </h2>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={t("date")}
            type="date"
            value={listenedOn}
            max={state.today}
            min="1900-01-01"
            required={!undated}
            hint={undated ? t("undatedHint") : undefined}
            onChange={(e) => setListenedOn(e.target.value)}
          />
          <SelectField
            label={t("format")}
            value={listenFormat}
            onChange={(e) => setListenFormat(e.target.value as ListenFormat | "")}
          >
            <option value="">{t("formatNone")}</option>
            {listenFormats.map((value) => (
              <option key={value} value={value}>
                {tf(value)}
              </option>
            ))}
          </SelectField>
        </div>

        <div>
          <p className="text-sm font-medium">{t("rating")}</p>
          <StarRating value={rating} onChange={setRating} className="mt-1" />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Checkbox
            label={t("liked")}
            checked={liked}
            onChange={(e) => setLiked(e.target.checked)}
          />
          <Checkbox
            label={t("relisten")}
            checked={relisten}
            onChange={(e) => setRelisten(e.target.checked)}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">{t("moods")}</legend>
          <p className="text-xs text-fg-muted">{t("moodsHint", { max: MOODS_PER_ENTRY_MAX })}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {moods.map((mood) => {
              const active = moodIds.includes(mood.id);
              return (
                <li key={mood.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleMood(mood.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm",
                      active
                        ? "border-star bg-star/10 text-star"
                        : "border-border text-fg-muted hover:border-star/60 hover:text-fg",
                    )}
                  >
                    {moodLabel(mood)}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label={t("moodNew")}
                value={newMood}
                maxLength={40}
                onChange={(e) => setNewMood(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMood();
                  }
                }}
              />
            </div>
            <Button variant="outline" onClick={addMood} disabled={pending || !newMood.trim()}>
              {t("moodAdd")}
            </Button>
          </div>
        </fieldset>

        {tracks.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">{t("tracks")}</legend>
            <p className="text-xs text-fg-muted">{t("tracksHint")}</p>
            <ol className="mt-2 divide-y divide-border/50">
              {tracks.map((track) => (
                <li key={track.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-fg-muted">
                    {track.position}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{track.title}</span>
                  <StarRating
                    size="sm"
                    label={track.title}
                    value={trackRatings.get(track.id) ?? null}
                    onChange={(value) =>
                      setTrackRatings((map) => {
                        const next = new Map(map);
                        if (value === null) next.delete(track.id);
                        else next.set(track.id, value);
                        return next;
                      })
                    }
                  />
                </li>
              ))}
            </ol>
            {suggestion !== null && suggestion !== rating && (
              <p className="mt-2 flex items-center gap-3 text-sm" aria-live="polite">
                <span className="text-fg-muted">
                  {t("suggestion", { stars: format.number(ratingToStars(suggestion)) })}
                </span>
                <Button variant="ghost" onClick={() => setRating(suggestion)}>
                  {t("applySuggestion")}
                </Button>
              </p>
            )}
          </fieldset>
        )}

        {entry === null ? (
          <div className="space-y-3">
            <TextArea
              label={t("review")}
              hint={t("reviewHint")}
              rows={4}
              maxLength={10_000}
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
            />
            {reviewBody.trim() && (
              <SelectField
                label={t("reviewLang")}
                value={reviewLang}
                onChange={(e) => setReviewLang(e.target.value as AudienceLang)}
              >
                <option value="fr">{tl("fr")}</option>
                <option value="en">{tl("en")}</option>
              </SelectField>
            )}
          </div>
        ) : (
          entry.review && (
            <p className="text-sm text-fg-muted">
              {t("reviewExisting")}{" "}
              <Link
                href={`/review/${entry.review.id}/edit`}
                className="text-link underline-offset-2 hover:underline"
              >
                {t("reviewEdit")}
              </Link>
            </p>
          )
        )}

        {error && <FormMessage tone="error">{te(error)}</FormMessage>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
          <Button variant="ghost" onClick={() => ref.current?.close()}>
            {t("cancel")}
          </Button>
          {entry && (
            <Button
              variant="ghost"
              className="ml-auto text-danger hover:text-danger"
              disabled={pending}
              // `detail` is 0 for a click made with the keyboard.
              onClick={(event) => onDelete(entry, event.detail === 0)}
            >
              {t("delete")}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}
