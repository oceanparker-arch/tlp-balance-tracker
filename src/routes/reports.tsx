import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · TLP Monitor" }] }),
  component: () => <Navigate to="/reports/jo" />,
});
