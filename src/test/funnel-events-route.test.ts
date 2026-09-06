// @vitest-environment node

import { afterEach, expect, it, vi } from "vitest";

const { insert, maybeSingle } = vi.hoisted(() => ({ insert: vi.fn(), maybeSingle: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceRoleSupabaseClient: () => ({
    from: (table: string) => table === "venues"
      ? { select: () => ({ eq: () => ({ maybeSingle }) }) }
      : { insert },
  }),
}));

const { POST } = await import("@/app/api/funnel-events/route");

const post = (body: unknown) => POST(new Request("https://arcora.example/api/funnel-events", { method: "POST", body: JSON.stringify(body) }));

afterEach(() => {
  insert.mockReset();
  maybeSingle.mockReset();
});

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

it("resolve o UUID do espaço pelo slug antes de gravar o clique", async () => {
  insert.mockResolvedValue({ error: null });
  maybeSingle.mockResolvedValue({ data: { id: "62ce8aac-bb13-40f6-a2db-445bf5c65f08" }, error: null });

  await post({ event: "venue_card_clicked", properties: { venueSlug: "casa-jardim-pinheiros", regionInterest: "Norte", searchZone: "Oeste" } });

  const row = insert.mock.calls[0][0] as Record<string, unknown>;
  expect(row).toMatchObject({ venue_id: "62ce8aac-bb13-40f6-a2db-445bf5c65f08", interested_region: "Norte", search_zone: "Oeste" });
});

it("preserva o clique anônimo sem espaço associado quando o slug não existe", async () => {
  insert.mockResolvedValue({ error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });

  const response = await post({ event: "venue_card_clicked", properties: { venueSlug: "espaco-removido" } });

  expect(response.status).toBe(201);
  expect(insert.mock.calls[0][0]).toMatchObject({ event_name: "venue_card_clicked", venue_id: null });
});

it("não grava evento quando a consulta do espaço falha", async () => {
  maybeSingle.mockResolvedValue({ data: null, error: { message: "banco indisponível" } });

  const response = await post({ event: "venue_card_clicked", properties: { venueSlug: "casa-jardim-pinheiros" } });

  expect(response.status).toBe(500);
  expect(insert).not.toHaveBeenCalled();
});
