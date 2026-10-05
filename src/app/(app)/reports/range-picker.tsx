"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RANGE_KEYS, RANGE_LABELS, type DateRange, type RangeKey } from "@/lib/reports";

/** Period selector synced to ?range= (plus ?from=&to= for a custom range). */
export function RangePicker({ range }: { range: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [key, setKey] = useState<RangeKey>(range.key);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function go(next: Record<string, string>) {
    router.replace(`${pathname}?${new URLSearchParams(next).toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go({ range: "custom", from, to });
      }}
    >
      <Select
        aria-label="Report period"
        className="w-auto"
        value={key}
        onChange={(e) => {
          const next = e.target.value as RangeKey;
          setKey(next);
          if (next !== "custom") go({ range: next });
        }}
      >
        {RANGE_KEYS.map((k) => (
          <option key={k} value={k}>
            {RANGE_LABELS[k]}
          </option>
        ))}
      </Select>
      {key === "custom" && (
        <>
          <Input
            type="date"
            aria-label="From date"
            className="w-auto"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            className="w-auto"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            required
          />
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </>
      )}
    </form>
  );
}
