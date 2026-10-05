import { Card } from "@/components/ui/card";

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Bar className="h-4 w-40" />
        <Bar className="h-7 w-64" />
        <Bar className="h-4 w-52" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Bar className="h-3 w-28" />
            <Bar className="h-7 w-36" />
            <Bar className="h-3 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <Bar className="mb-6 h-4 w-48" />
          <Bar className="h-[260px] w-full" />
        </Card>
        <Card className="space-y-4 p-5">
          <Bar className="h-4 w-32" />
          {Array.from({ length: 5 }, (_, i) => (
            <Bar key={i} className="h-10 w-full" />
          ))}
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-2">
          <Bar className="h-4 w-36" />
          {Array.from({ length: 5 }, (_, i) => (
            <Bar key={i} className="h-8 w-full" />
          ))}
        </Card>
        <Card className="space-y-3 p-5">
          <Bar className="h-4 w-32" />
          {Array.from({ length: 4 }, (_, i) => (
            <Bar key={i} className="h-10 w-full" />
          ))}
        </Card>
      </div>
    </div>
  );
}
