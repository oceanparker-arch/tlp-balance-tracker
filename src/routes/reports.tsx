import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · TLP Monitor" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/reports/jo" });
  },
  component: () => null,
});
