// src/renderer/lib/utils.ts
// shadcn/ui utility — class name merging helper.
// Managed by shadcn CLI; do not hand-edit beyond this level.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
