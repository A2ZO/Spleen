"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  href,
  className,
  variant = "outline",
  children,
}: {
  /** Where to go once signed out (localized home). */
  href: string;
  className?: string;
  variant?: "outline" | "ghost";
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant={variant}
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push(href);
        router.refresh();
      }}
    >
      {children}
    </Button>
  );
}
