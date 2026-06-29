import { createFileRoute, redirect } from "@tanstack/react-router";

// The legacy Voice Lab "new" form has been superseded by the Voice Studio
// (/studio/voices), which opens a Create dialog with Clone / Design / Instant
// modes wired to the voice_profiles pipeline. Redirect so any old link or
// button lands users on the working flow.
export const Route = createFileRoute("/_authenticated/voices/new")({
  beforeLoad: () => {
    throw redirect({ to: "/studio/voices", search: { create: 1 } as never });
  },
  component: () => null,
});
