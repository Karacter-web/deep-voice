import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] grid place-items-center px-4 py-12">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">Something broke loading this page</h2>
        <p className="text-sm text-muted-foreground break-words">
          {error.message || "Unexpected error"}
        </p>
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4 py-12">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">Not found</h2>
        <p className="text-sm text-muted-foreground">
          We couldn't find what you were looking for.
        </p>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
