import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { isInterestRegion } from "@/data/regions";

const eventNames = new Set([
  "search_started", "search_submitted", "activity_selected", "location_selected", "date_selected",
  "guest_count_selected", "venue_card_clicked", "category_clicked", "city_clicked", "corporate_cta_clicked", "signup_clicked",
  "region_interest_selected",
]);

export async function POST(request: Request) {
  const payload = await request.json() as { event?: unknown; properties?: Record<string, unknown> };
  if (typeof payload.event !== "string" || !eventNames.has(payload.event)) return NextResponse.json({ error: "Evento inválido." }, { status: 422 });
  const properties = payload.properties ?? {};
  try {
    const supabase = createServiceRoleSupabaseClient();
    const venueSlug = typeof properties.venueSlug === "string" ? properties.venueSlug : null;
    let venueId: string | null = null;
    if (venueSlug) {
      const { data: venue, error: venueError } = await supabase.from("venues").select("id").eq("slug", venueSlug).maybeSingle();
      if (venueError) throw new Error(`Falha ao consultar espaço: ${venueError.message}`);
      venueId = (venue as { id?: string } | null)?.id ?? null;
    }
    const region = typeof properties.regionInterest === "string" && isInterestRegion(properties.regionInterest) ? properties.regionInterest : null;
    const searchZone = typeof properties.searchZone === "string" && isInterestRegion(properties.searchZone) ? properties.searchZone : null;
    const { error } = await supabase.from("funnel_events").insert({
      event_name: payload.event,
      venue_id: venueId,
      event_type: typeof properties.eventType === "string" ? properties.eventType : null,
      neighborhood: typeof properties.neighborhood === "string" ? properties.neighborhood : null,
      event_date: typeof properties.eventDate === "string" && properties.eventDate.trim() ? properties.eventDate : null,
      guest_count: typeof properties.guestCount === "number" && Number.isInteger(properties.guestCount) && properties.guestCount >= 1 && properties.guestCount <= 5000 ? properties.guestCount : null,
      budget: typeof properties.budget === "string" ? properties.budget : null,
      displayed_price: typeof properties.displayedPrice === "string" ? properties.displayedPrice : null,
      source: typeof properties.source === "string" ? properties.source : null,
      campaign: typeof properties.campaign === "string" ? properties.campaign : null,
      session_id: typeof properties.sessionId === "string" ? properties.sessionId : null,
      occurred_at: new Date().toISOString(),
      ...(region ? { interested_region: region } : {}),
      ...(searchZone ? { search_zone: searchZone } : {}),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }
}
