import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:hover:bg-accent",
  secondary: "border border-line bg-surface text-ink hover:bg-soft",
  ghost: "text-ink hover:bg-bg-alt",
  /** Sobre fondos verdes: relleno crema con texto verde. */
  onDark: "bg-bg text-accent hover:bg-accent-mid",
} as const;

const sizes = {
  sm: "min-h-11 px-4 py-2 text-sm",
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
} as const;

/** Clases de un botón. Sirve para <button> y para <Link>. */
export function buttonClass(
  variant: keyof typeof variants = "primary",
  size: keyof typeof sizes = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}
