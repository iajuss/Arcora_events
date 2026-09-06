import Link from "next/link";
import { VenueCard } from "@/components/home/venue-card";
import { SearchRefinementForm } from "@/components/search/search-refinement-form";
import { venues } from "@/data/venues";
import { filterVenues, recommendVenues, type VenueFilters } from "@/lib/venue-results";
import { activityOptions, canonicalActivity, canonicalLocation, canonicalStyle, locationOptions } from "@/data/search-options";
import { interestRegions, isInterestRegion } from "@/data/regions";

type SearchValues = VenueFilters & { date?: string; regionInterest?: string };
type SearchPageProps = { searchParams: Promise<SearchValues> };

const styleOptions = ["Jardim", "Rooftop", "Industrial", "Histórico", "Estúdio"];

const shortLocation = (option: string) => option.replace(/, São Paulo, SP$/, "");

function searchHref(values: SearchValues, update: Partial<VenueFilters>) {
  const parameters = new URLSearchParams();
  const nextValues = { ...values, ...update };
  Object.entries(nextValues).forEach(([key, value]) => {
    if (value && (key !== "regionInterest" || isInterestRegion(value))) parameters.set(key, value);
  });
  const query = parameters.toString();
  return query ? `/buscar?${query}` : "/buscar";
}

function FilterGroup({ label, options, parameter, values, formatOption }: { label: string; options: readonly string[]; parameter: keyof VenueFilters; values: SearchValues; formatOption?: (option: string) => string }) {
  return <div>
    <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = values[parameter] === option;
        return <Link aria-pressed={selected} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white hover:border-[var(--primary)] hover:text-[var(--primary)]"}`} href={searchHref(values, { [parameter]: selected ? undefined : option })} key={option}>{formatOption ? formatOption(option) : option}</Link>;
      })}
    </div>
  </div>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const requested = await searchParams;
  const regionInterest = isInterestRegion(requested.regionInterest) ? requested.regionInterest : undefined;
  // Atalhos da home chegam no plural ou por slug; a busca trabalha com o rotulo
  // canonico, tanto para filtrar quanto para marcar a pilula correspondente.
  const values: SearchValues = {
    ...requested,
    regionInterest,
    zone: isInterestRegion(requested.zone) ? requested.zone : undefined,
    activity: requested.activity ? canonicalActivity(requested.activity) ?? requested.activity : undefined,
    location: requested.location ? canonicalLocation(requested.location) ?? requested.location : undefined,
    style: requested.style ? canonicalStyle(requested.style) ?? requested.style : undefined,
  };
  const exactResults = filterVenues(venues, values);
  const results = exactResults;
  const hasFilters = Boolean(values.activity || values.location || values.zone || values.guests || values.style || values.date || regionInterest);
  const recommendations = !exactResults.length && hasFilters ? recommendVenues(venues, values) : [];

  return <main className="min-h-screen bg-[var(--secondary)] px-5 py-12 sm:py-16">
    <div className="mx-auto max-w-7xl">
      <Link className="text-sm font-semibold text-[var(--primary)]" href="/">← Voltar para a Arcora</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr] lg:items-start">
        <aside className="rounded-3xl bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Refine sua busca</p>
          <h1 className="mt-3 font-display text-4xl leading-none">Espaços para o seu plano.</h1>
          <div className="mt-7 space-y-6">
            <FilterGroup label="Ocasião" options={activityOptions} parameter="activity" values={values} />
            <FilterGroup formatOption={shortLocation} label="Localização" options={[...locationOptions]} parameter="location" values={values} />
            <FilterGroup label="Zona" options={interestRegions} parameter="zone" values={values} />
            <FilterGroup label="Estilo" options={styleOptions} parameter="style" values={values} />
            <FilterGroup label="Pessoas" options={["80", "150", "250"]} parameter="guests" values={values} />
            <SearchRefinementForm values={values} />
          </div>
          {hasFilters ? <Link className="mt-7 inline-flex text-sm font-semibold text-[var(--primary)] underline underline-offset-4" href="/buscar">Limpar filtros</Link> : null}
        </aside>

        <section aria-live="polite">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Arcora em São Paulo</p>
          <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">{exactResults.length ? `${exactResults.length} ${exactResults.length === 1 ? "espaço encontrado" : "espaços encontrados"}` : "Nenhum espaço encontrado"}</h2>
          {hasFilters ? <dl className="mt-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-5 text-sm sm:grid-cols-2"><div><dt className="text-[var(--muted)]">Ocasião</dt><dd className="mt-1 font-semibold">{values.activity || "A definir"}</dd></div><div><dt className="text-[var(--muted)]">Local</dt><dd className="mt-1 font-semibold">{values.location || "A definir"}</dd></div><div><dt className="text-[var(--muted)]">Zona</dt><dd className="mt-1 font-semibold">{values.zone || "A definir"}</dd></div><div><dt className="text-[var(--muted)]">Pessoas</dt><dd className="mt-1 font-semibold">{values.guests || "A definir"}</dd></div><div><dt className="text-[var(--muted)]">Data</dt><dd className="mt-1 font-semibold">{values.date || "A definir"}</dd></div>{regionInterest ? <div><dt className="text-[var(--muted)]">Região de interesse</dt><dd className="mt-1 font-semibold">{regionInterest}</dd></div> : null}</dl> : null}
          {!exactResults.length && hasFilters ? <p className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5 text-[var(--muted)]">Ainda não encontramos um espaço com essa combinação. Ajuste os filtros ou conte um pouco mais sobre o seu evento.</p> : null}
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((venue) => <VenueCard activity={values.activity} key={venue.id} regionInterest={regionInterest} searchContext={{ location: values.location, zone: values.zone, date: values.date, guests: values.guests }} showPrice source="search_results" venue={venue} />)}
          </div>
          {recommendations.length ? <section className="mt-12" aria-labelledby="recommendations-heading">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Uma alternativa para você</p>
            <h3 className="mt-3 font-display text-3xl leading-none sm:text-4xl" id="recommendations-heading">Sugestões para o seu evento</h3>
            <p className="mt-3 max-w-2xl text-[var(--muted)]">Não são correspondências exatas, mas estes espaços se aproximam dos filtros escolhidos.</p>
            <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((venue) => <VenueCard activity={values.activity} key={venue.id} regionInterest={regionInterest} searchContext={{ location: values.location, zone: values.zone, date: values.date, guests: values.guests }} showPrice source="search_recommendations" venue={venue} />)}
            </div>
          </section> : null}
        </section>
      </div>
    </div>
  </main>;
}
