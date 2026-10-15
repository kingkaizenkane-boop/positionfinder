import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "PositionFinder · Testing workspace" },
      { name: "description", content: "Open testing workspace for positional transition analysis." },
      { property: "og:title", content: "PositionFinder · Testing workspace" },
      { property: "og:description", content: "Open testing workspace for positional transition analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});