import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/auth-panel";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · PositionFinder" },
      { name: "description", content: "Sign in to PositionFinder to manage historical data and saved analyses." },
      { property: "og:title", content: "Sign in · PositionFinder" },
      { property: "og:description", content: "Access your PositionFinder historical data and saved analyses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPanel,
});