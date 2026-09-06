// @vitest-environment node

import { afterEach, expect, it, vi } from "vitest";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleSupabaseClient: () => ({ from: () => ({ insert }) }),
}));

const { POST } = await import("@/app/api/funnel-events/route");

const post = (body: unknown) => POST(new Request("https://arcora.example/api/funnel-events", { method: "POST", body: JSON.stringify(body) }));

afterEach(() => insert.mockReset());

it("registra a região escolhida sem vincular a nenhum usuário", async () => {
  insert.mockResolvedValue({ error: null });

  const response = await post({ event: "region_interest_selected", properties: { regionInterest: "Norte", sessionId: "anon-123" } });

  expect(response.status).toBe(201);
  const row = insert.mock.calls[0][0] as Record<string, unknown>;
  expect(row).toMatchObject({ event_name: "region_interest_selected", interested_region: "Norte", session_id: "anon-123" });
  expect(Object.keys(row)).not.toContain("user_id");
  expect(row.occurred_at).toEqual(expect.any(String));
});

it("descarta uma região fora das cinco zonas de São Paulo", async () => {
  insert.mockResolvedValue({ error: null });

  await post({ event: "region_interest_selected", properties: { regionInterest: "Nordeste" } });

  expect(Object.keys(insert.mock.calls[0][0] as Record<string, unknown>)).not.toContain("interested_region");
});

it("omite a coluna de região nos demais eventos, para sobreviver a um deploy anterior à migration", async () => {
  insert.mockResolvedValue({ error: null });

  await post({ event: "search_started", properties: { sessionId: "anon-9" } });

  const row = insert.mock.calls[0][0] as Record<string, unknown>;
  expect(Object.keys(row)).not.toContain("interested_region");
  expect(row.event_name).toBe("search_started");
});

it("recusa um evento que não pertence ao funil", async () => {
  const response = await post({ event: "regiao_inventada", properties: {} });

  expect(response.status).toBe(422);
  expect(insert).not.toHaveBeenCalled();
});

it("grava vertical e praça de uma busca enviada, sem usuário algum", async () => {
  insert.mockResolvedValue({ error: null });

  await post({ event: "search_submitted", properties: { eventType: "Casamento", neighborhood: "Pinheiros, São Paulo, SP", guestCount: 150, eventDate: "2026-08-12", source: "hero", sessionId: "anon-7" } });

  const row = insert.mock.calls[0][0] as Record<string, unknown>;
  expect(row).toMatchObject({
    event_name: "search_submitted",
    event_type: "Casamento",
    neighborhood: "Pinheiros, São Paulo, SP",
    guest_count: 150,
    event_date: "2026-08-12",
    source: "hero",
    session_id: "anon-7",
  });
  expect(Object.keys(row)).not.toContain("user_id");
});

it("anula data vazia e contagem fora de faixa, que violariam as restrições da coluna", async () => {
  insert.mockResolvedValue({ error: null });

  await post({ event: "search_submitted", properties: { eventDate: "", guestCount: 0 } });

  const row = insert.mock.calls[0][0] as Record<string, unknown>;
  expect(row.event_date).toBeNull();
  expect(row.guest_count).toBeNull();
});

it("mantém zona do filtro e região de interesse como dimensões distintas no clique do catálogo", async () => {
  insert.mockResolvedValue({ error: null });

  await post({ event: "venue_card_clicked", properties: { venueId: "venue-123", regionInterest: "Norte", searchZone: "Oeste" } });

  const row = insert.mock.calls[0][0] as Record<string, unknown>;
  expect(row).toMatchObject({ venue_id: "venue-123", interested_region: "Norte", search_zone: "Oeste" });
});
