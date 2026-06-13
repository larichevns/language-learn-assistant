import { Card, CardContent } from '@/components/ui/card';

export function Stub({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 font-display text-2xl font-bold">{title}</h1>
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">{hint}</CardContent>
      </Card>
    </div>
  );
}
