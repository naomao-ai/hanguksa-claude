"use client";

import { cn } from "@/lib/utils";

export default function Chips({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            value === o.value ? "border-primary bg-primary/12 text-primary" : "hover:bg-surface-2"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
