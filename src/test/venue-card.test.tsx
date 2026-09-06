import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import * as analytics from "@/lib/analytics";
import { VenueCard } from "@/components/home/venue-card";
import { venues } from "@/data/venues";

it("links to the venue detail route", () => {
  render(<VenueCard venue={venues[0]} />);
  expect(screen.getByText(venues[0].name)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: new RegExp(`ver detalhes de ${venues[0].name}`, "i") })).toHaveAttribute("href", "/espacos/casa-jardim-pinheiros");
});

it("preserves a declared region in the venue detail link", () => {
  render(<VenueCard venue={venues[0]} regionInterest="Oeste" />);

  expect(screen.getByRole("link", { name: /ver detalhes/i })).toHaveAttribute("href", "/espacos/casa-jardim-pinheiros?regionInterest=Oeste");
});

it("preserves the selected compatible occasion when opening a venue", () => {
  render(<VenueCard venue={venues[0]} activity="Casamento" />);

  expect(screen.getByRole("link", { name: /ver detalhes/i })).toHaveAttribute("href", "/espacos/casa-jardim-pinheiros?activity=Casamento");
});

it("preserves the compatible occasion together with the regional preference", () => {
  render(<VenueCard venue={venues[0]} activity="Casamento" regionInterest="Oeste" />);

  expect(screen.getByRole("link", { name: /ver detalhes/i })).toHaveAttribute("href", "/espacos/casa-jardim-pinheiros?activity=Casamento&regionInterest=Oeste");
});

it("preserves any selected occasion in the venue detail link", () => {
  render(<VenueCard venue={venues[0]} activity="Workshop" />);

  expect(screen.getByRole("link", { name: /ver detalhes/i })).toHaveAttribute("href", "/espacos/casa-jardim-pinheiros?activity=Workshop");
});

it("shows the primary category only in the event-type chips", () => {
  render(<VenueCard venue={venues[0]} />);

  expect(screen.getByText("Até 120 pessoas")).toBeInTheDocument();
  expect(screen.getByText("Até 120 pessoas")).not.toHaveTextContent("Festa");
  expect(screen.getAllByTestId("occasion-chip")[0]).toHaveTextContent("Festa");
});

it("resumes as ocasiões extras sem esconder a lista completa de tecnologias assistivas", () => {
  const flexibleVenue = {
    ...venues[0],
    eventTypes: [
      "Festa",
      "Casamento",
      "Evento corporativo",
      "Reunião",
      "Workshop",
      "Produção",
      "Ensaio",
      "Lançamento",
    ],
  };

  render(<VenueCard venue={flexibleVenue} />);

  expect(screen.getByText("Festa")).toBeInTheDocument();
  expect(screen.getByText("Casamento")).toBeInTheDocument();
  expect(screen.getAllByTestId("occasion-chip")).toHaveLength(2);
  expect(screen.getByTestId("more-occasion-types")).toHaveAccessibleName("Mais 6 tipos: Evento corporativo, Reunião, Workshop, Produção, Ensaio, Lançamento");
  expect(screen.getByTestId("more-occasion-types")).toHaveTextContent("+6");
});

it("registra anonimamente o espaço e os filtros ao abri-lo pelo catálogo", async () => {
  const user = userEvent.setup();
  const listener = vi.fn();
  window.addEventListener("arcora:analytics", listener);

  render(<div onClickCapture={(event) => event.preventDefault()}><VenueCard activity="Casamento" regionInterest="Norte" searchContext={{ location: "Pinheiros, São Paulo, SP", zone: "Oeste", date: "2026-10-20", guests: "120" }} source="search_results" venue={venues[0]} /></div>);

  await user.click(screen.getByRole("link", { name: new RegExp(`ver detalhes de ${venues[0].name}`, "i") }));

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].detail).toMatchObject({
    event: "venue_card_clicked",
    properties: {
      venueId: venues[0].id,
      eventType: "Casamento",
      neighborhood: "Pinheiros, São Paulo, SP",
      regionInterest: "Norte",
      searchZone: "Oeste",
      eventDate: "2026-10-20",
      guestCount: 120,
      source: "search_results",
    },
  });

  window.removeEventListener("arcora:analytics", listener);
});

it("não impede a abertura do espaço se o rastreamento falhar de forma síncrona", () => {
  const trackingFailure = vi.spyOn(analytics, "track").mockImplementation(() => { throw new Error("analytics indisponível"); });
  render(<div onClickCapture={(event) => event.preventDefault()}><VenueCard venue={venues[0]} /></div>);

  expect(() => fireEvent.click(screen.getByRole("link", { name: new RegExp(`ver detalhes de ${venues[0].name}`, "i") }))).not.toThrow();

  trackingFailure.mockRestore();
});
