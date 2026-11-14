"use client";

import { useState } from "react";

import { StarRating } from "@/components/ui/StarRating";

/** Local state only: the demo page saves nothing. */
export function DemoRating({
  label,
  size,
  initial,
}: {
  label: string;
  size: "sm" | "md" | "lg";
  initial: number | null;
}) {
  const [value, setValue] = useState(initial);
  return <StarRating value={value} onChange={setValue} label={label} size={size} />;
}
