import { Card } from "@/components/ui/card";

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading reports">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Bar className="h-7 w-32" />
          <Bar className="h-4 w-64" />
        </div>
        <Bar className="h-9 w-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Bar className="h-3 w-24" />
            <Bar className="h-7 w-32" />
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-5">
        <Bar className="h-4 w-36" />
        <Bar className="h-[280px] w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Bar key={i} className="h-6 w-full" />
        ))}
      </Card>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="space-y-4 p-5 xl:col-span-2">
          <Bar className="h-4 w-40" />
          <Bar className="mx-auto h-48 w-48 rounded-full" />
        </Card>
        <Card className="space-y-3 p-5 xl:col-span-3">
          <Bar className="h-4 w-36" />
          {Array.from({ length: 6 }, (_, i) => (
            <Bar key={i} className="h-8 w-full" />
          ))}
        </Card>
      </div>
    </div>
  );
}
