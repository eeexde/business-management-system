"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "./input";

/** A <select> that syncs its value to a URL search param. Empty value removes the param. */
export function FilterSelect({
  param,
  options,
  label,
  allLabel = "All",
}: {
  param: string;
  options: { value: string; label: string }[];
  label: string;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <Select
      aria-label={label}
      className="w-auto"
      value={searchParams.get(param) ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set(param, e.target.value);
        else params.delete(param);
        params.delete("page");
        const next = params.toString();
        router.replace(`${pathname}${next ? `?${next}` : ""}`);
      }}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
