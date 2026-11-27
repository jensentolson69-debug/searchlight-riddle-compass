import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/refresh-tracker")({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    try {
      const { refreshTracker } = await import("@/lib/tracker-sync.server");
      return Response.json(await refreshTracker());
    } catch (error) {
      console.error("tracker refresh failed", error);
      return Response.json({ refreshed: false, error: "Tracker refresh failed; previous information retained" }, { status: 503 });
    }
  } } },
});