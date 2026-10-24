import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";

/** Plain footer for now; legal links come with milestone 9. */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-10 text-sm text-fg-muted sm:px-6">
        <Logo className="text-fg" />
        <LocaleSwitcher />
      </div>
    </footer>
  );
}
