import { LoaderCircle } from 'lucide-react';
export function PageLoader({ text = "Initializing SolvaSure..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <LoaderCircle className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg font-medium text-muted-foreground">{text}</p>
    </div>
  );
}