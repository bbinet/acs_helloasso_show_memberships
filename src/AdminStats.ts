// Onglet « Statistiques » de la page admin et ses sous-onglets : chiffres clés, tableaux et graphes
// (Chart.js, chargé depuis jsDelivr)
import type { Chart as ChartJs, ChartConfiguration } from "chart.js";
import type { Invoice } from "./InvoiceData.js";
import { statusCategory, type InvoiceStatus } from "./InvoiceService";
import { loadScript } from "./loadScript";
import { escape, euros } from "./format";
import { activitiesBySeason, activityCounts, byActivity, byFormula, bySeasonMonth, cumulative, keyFigures, seasonCurve, totalsBySeason,
         untilSameDay, type ActivityGroup, type Member } from "./Stats";

const CHARTJS = {
    src: "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js",
    integrity: "sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ",
};

// Couleurs : une série = bleu ; saison en cours et saison précédente = bleu et orange (palette validée pour les
// daltoniens), saisons plus anciennes en gris
const SERIES = ["#2a78d6", "#eb6834"];
const MUTED = "#898781";
const GRID = "#e1e0d9";
const ACTIVITY_COUNTS = ["Aucune activité", "1 activité", "2 activités", "3 activités et plus"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

type Statuses = Record<string, InvoiceStatus>;
// Saisons archivées, de la plus récente à la plus ancienne
export interface SeasonHistory { season: string; members: Member[] }

const shortDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
// Jour de saison (depuis le 1er juillet) => « 15 sept. »
const seasonDayLabel = (day: number) => shortDate(new Date(Date.UTC(2001, 6, 1) + day * 86400000).toISOString().slice(0, 10));

let charts: ChartJs[] = [];

// Axes : valeurs à partir de 0 avec une grille discrète ; catégories sans grille (dates espacées pour les courbes)
const axes = (options: { horizontal?: boolean; time?: boolean } = {}) => {
    const value = { beginAtZero: true, ticks: { color: MUTED, precision: 0 }, grid: { color: GRID }, border: { display: false } };
    const category = { ticks: { color: MUTED, ...(options.time && { maxTicksLimit: 12, maxRotation: 0 }) }, grid: { display: false } };
    return options.horizontal ? { x: value, y: category } : { x: category, y: value };
};

const draw = (id: string, config: ChartConfiguration, legend = false) => {
    const Chart = (window as any).Chart as typeof ChartJs;
    const canvas = document.getElementById(id) as HTMLCanvasElement;
    charts.push(new Chart(canvas, {
        ...config,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            ...config.options,
            plugins: { legend: { display: legend, labels: { color: MUTED, usePointStyle: true } } },
        },
    } as ChartConfiguration));
};

// Couleur de la saison n° index (0 = en cours) sur count saisons : bleu, orange, puis des gris du plus sombre
// (la plus récente des anciennes saisons) au plus clair (la plus ancienne)
const seasonColor = (index: number, count: number) => {
    if (index < SERIES.length)
        return SERIES[index];
    const grays = count - SERIES.length;
    const t = grays > 1 ? (index - SERIES.length) / (grays - 1) : 0;
    const level = Math.round(0x6f + t * (0xd0 - 0x6f)).toString(16);
    return `#${level}${level}${level}`;
};

// Barres « en fin de saison », à côté des barres bleues « au même jour »
const ENDED = "#c3c2b7";
// Barres par saison : la saison en cours, pas terminée, en bleu plus clair
const CURRENT = "#8fb8ea";
const seasonBars = (seasons: string[], current: string) => seasons.map((name) => (name === current ? CURRENT : SERIES[0]));

// Aujourd'hui (« AAAA-MM-JJ »), à Paris
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

const bar = { borderRadius: 4, borderSkipped: "start" as const, maxBarThickness: 28 };
const line = (label: string, data: (number | null)[], color: string, stepped = false) =>
    ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, stepped });

// Valeur d'une courbe cumulée (points triés) à chaque abscisse demandée (triées), en un seul parcours
const stepValues = <T>(points: (T & { count: number })[], key: (point: T) => string | number, xs: (string | number)[]) => {
    let index = -1;
    return xs.map((x) => {
        while (index + 1 < points.length && key(points[index + 1]) <= x)
            index++;
        return index < 0 ? 0 : points[index].count;
    });
};

// Chaque affichage efface le précédent ; un affichage dépassé par un autre pendant le chargement de Chart.js s'arrête là
let rendering = 0;
const reset = () => {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    return ++rendering;
};
const loadChartJs = async (current: number) => {
    await loadScript(CHARTJS);
    return current === rendering;
};

// Bloc de statistiques : un cadre avec son titre et une explication éventuelle
const block = (title: string, body: string, note = "") =>
    `<section class="stats-block"><h3>${title}</h3>${note ? `<p class="note">${note}</p>` : ""}${body}</section>`;
const canvas = (id: string, label: string, height = "") =>
    `<div class="chart"${height ? ` style="height:${height}"` : ""}><canvas id="${id}" aria-label="${label}"></canvas></div>`;

// Saison affichée par le bilan : la saison en cours tant qu'aucune autre n'est choisie
let shownSeason: string | null = null;

// Écart avec une autre saison, sous un chiffre clé : « ▲ +32 par rapport à 2025-2026 au 10 oct. »
const delta = (value: number, other: number, label: string, format = (n: number) => String(n)) => {
    const diff = Math.round((value - other) * 100) / 100;
    const text = diff > 0 ? `▲ +${format(diff)}` : diff < 0 ? `▼ −${format(-diff)}` : "=";
    return `<div class="delta ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${text} par rapport à ${escape(label)}</div>`;
};

// Sous-onglet « Bilan de saison » : chiffres clés, inscriptions, tarifs, activités et nombre d'activités par adhérent
// de la saison en cours, ou d'une saison archivée choisie au-dessus. Les saisons archivées n'ont pas de données
// personnelles (pas de listes d'adhérents) ni de statuts d'envoi des factures.
export async function renderStats(container: HTMLElement, season: string, invoices: Invoice[], statuses: Statuses, history: SeasonHistory[]) {
    const current = reset();
    // Toutes les saisons, de la plus récente (en cours) à la plus ancienne
    const seasons: SeasonHistory[] = [{ season, members: invoices }, ...history];
    const index = Math.max(0, seasons.findIndex((s) => s.season === shownSeason));
    const isCurrent = index === 0;
    const { members } = seasons[index];
    const previous = seasons[index + 1];
    const date = today();
    // Comparaison avec la saison précédente : au même jour pour la saison en cours, entière pour une saison terminée
    const reference = previous && (isCurrent ? untilSameDay(previous.season, previous.members, season, date) : previous.members);
    const referenceLabel = previous ? `${previous.season}${isCurrent ? ` au ${shortDate(date)}` : ""}` : "";
    const figures = keyFigures(members, isCurrent ? statuses : {});
    const activities = byActivity(members);
    const formulas = byFormula(members);
    const activitiesHeight = `${Math.max(12, activities.length * 2.2)}rem`;
    const tile = (value: string | number, label: string, extra = "") =>
        `<div class="tile"><div class="value">${value}</div><div class="label">${label}</div>${extra}</div>`;
    const activityName = (group: ActivityGroup<Member>) => isCurrent
        ? `<details><summary>${escape(group.name)}</summary><ul>${(group.members as Invoice[])
            .map((m) => `<li>${escape(m.firstName)} ${escape(m.lastName)}${m.company ? ` (${escape(m.company)})` : ""}</li>`).join("")}</ul></details>`
        : escape(group.name);

    container.innerHTML = `
      <div class="season-picker" role="group" aria-label="Saison affichée">
        <span>Saison :</span>
        ${seasons.map((s, i) => `<button data-season="${escape(s.season)}" aria-pressed="${i === index}">${escape(s.season)}${i === 0 ? " (en cours)" : ""}</button>`).join("")}
      </div>
      ${isCurrent ? "" : `<p class="note">Saison terminée : les listes d'adhérents et l'envoi des factures ne sont disponibles que pour la saison en cours.</p>`}
      <div class="tiles">
        ${tile(figures.members, "adhérents", reference ? delta(figures.members, reference.length, referenceLabel) : "")}
        ${tile(euros(figures.revenue), "encaissés", reference ? delta(figures.revenue, keyFigures(reference, {}).revenue, referenceLabel, euros) : "")}
        ${isCurrent ? `
        ${tile(figures.sent, "factures envoyées")}
        ${tile(figures.todo, "factures à envoyer")}
        ${tile(figures.problems, "factures en erreur")}` : ""}
      </div>
      ${block(isCurrent ? "Inscriptions depuis le début de la saison" : "Inscriptions au fil de la saison",
          canvas("chart-cumulative", isCurrent ? "Nombre cumulé d'inscriptions et de factures envoyées" : "Nombre cumulé d'inscriptions"))}
      ${block("Adhérents par tarif", `
        <table>
          <thead><tr><th>Tarif</th><th>Adhérents</th><th>Recettes du tarif (sans les options)</th></tr></thead>
          <tbody>${formulas.map((formula) => `<tr><td>${escape(formula.name)}</td><td>${formula.count}</td><td>${euros(formula.revenue)}</td></tr>`).join("")}</tbody>
        </table>`)}
      ${block("Adhérents par activité", `
        ${canvas("chart-activities", "Adhérents par activité", activitiesHeight)}
        <table>
          <thead><tr><th>Activité</th><th>Adhérents</th><th>Recettes des options</th></tr></thead>
          <tbody>${activities.map((group) => `
            <tr>
              <td>${activityName(group)}</td>
              <td>${group.count}</td>
              <td>${euros(group.revenue)}</td>
            </tr>`).join("")}
          </tbody>
        </table>`)}
      ${block("Nombre d'activités par adhérent", canvas("chart-counts", "Nombre d'activités par adhérent", "16rem"))}`;

    container.querySelectorAll<HTMLButtonElement>(".season-picker button").forEach((button) =>
        button.addEventListener("click", () => {
            shownSeason = button.dataset.season!;
            renderStats(container, season, invoices, statuses, history).catch(console.error);
        }));

    if (!await loadChartJs(current))
        return;

    // Inscriptions et factures envoyées : même unité (nombre d'adhérents), donc un seul axe
    const registered = cumulative(members.map((member) => member.date));
    const sent = isCurrent ? cumulative(invoices.map((invoice) => statuses[invoice.id])
        .filter((status) => statusCategory(status) === "sent").map((status) => status.date.slice(0, 10))) : [];
    const days = [...new Set([...registered, ...sent].map((point) => point.date))].sort();
    const byDate = (point: { date: string }) => point.date;
    draw("chart-cumulative", {
        type: "line",
        data: {
            labels: days.map(shortDate),
            datasets: [
                line("Inscriptions", stepValues(registered, byDate, days), SERIES[0], true),
                ...(isCurrent ? [line("Factures envoyées", stepValues(sent, byDate, days), SERIES[1], true)] : []),
            ],
        },
        options: { scales: axes({ time: true }) },
    }, isCurrent);

    const names = activities.map((group) => group.name);
    draw("chart-activities", {
        type: "bar",
        data: { labels: names, datasets: [{ label: "Adhérents", data: activities.map((group) => group.count), backgroundColor: SERIES[0], ...bar }] },
        options: { indexAxis: "y", scales: axes({ horizontal: true }), interaction: { mode: "nearest", axis: "y", intersect: false } },
    });

    draw("chart-counts", {
        type: "bar",
        data: {
            labels: ACTIVITY_COUNTS,
            datasets: [{ label: "Adhérents", data: activityCounts(members), backgroundColor: SERIES[0], ...bar }],
        },
        options: { scales: axes() },
    });
}

// Sous-onglet « Comparaison des saisons » : la saison en cours face à toutes les saisons précédentes, puis face à la
// saison précédente
export async function renderSeasonsStats(container: HTMLElement, season: string, invoices: Invoice[], history: SeasonHistory[]) {
    const current = reset();
    // Toutes les saisons, de la plus récente (en cours) à la plus ancienne
    const seasons: SeasonHistory[] = [{ season, members: invoices }, ...history];
    if (seasons.length < 2) {
        container.innerHTML = `<p>Pas encore de saison précédente à comparer.</p>`;
        return;
    }
    const [, previous] = seasons;
    const date = today();
    const sameDay = shortDate(date);
    const totals = totalsBySeason(seasons, date);
    // Pour la saison en cours, pas terminée, les colonnes « en fin de saison » restent vides
    const ended = (total: (typeof totals)[number], value: string | number) => (total.season === season ? "" : value);

    container.innerHTML = `
      ${block("Inscriptions au fil de la saison", canvas("chart-seasons", "Inscriptions cumulées par saison"),
          "Nombre cumulé d'inscriptions, au même jour de chaque saison.")}
      ${block("Nombre d'adhérents de chaque saison", `
        ${canvas("chart-totals", "Adhérents de chaque saison au même jour et en fin de saison", "16rem")}
        <table>
          <thead><tr><th>Saison</th><th>Adhérents au ${sameDay}</th><th>Adhérents en fin de saison</th>
            <th>Montant encaissé au ${sameDay}</th><th>Montant encaissé en fin de saison</th></tr></thead>
          <tbody>${[...totals].reverse().map((total) => `<tr><td>${escape(total.season)}${total.season === season ? " (en cours)" : ""}</td>
            <td>${total.membersAtSameDay}</td><td>${ended(total, total.members)}</td>
            <td>${euros(total.revenueAtSameDay)}</td><td>${ended(total, euros(total.revenue))}</td></tr>`).join("")}</tbody>
        </table>`, `Pour chaque saison, les adhérents inscrits au ${sameDay} (même date qu'aujourd'hui), et le total à la fin de la saison.`)}
      <div class="stats-grid">
        ${block("Inscriptions par mois", canvas("chart-months", "Inscriptions par mois, saison en cours et précédente", "18rem"),
            `Saison ${escape(season)} comparée à toute la saison ${escape(previous.season)}.`)}
        ${block("Nombre d'activités par adhérent", canvas("chart-counts", "Nombre d'activités par adhérent, saison en cours et précédente", "18rem"),
            `Saison ${escape(previous.season)} au même jour (${sameDay}), pour comparer ce qui est comparable.`)}
      </div>`;

    if (!await loadChartJs(current))
        return;

    const curves = seasons.map(({ season: name, members }) => ({ name, points: seasonCurve(name, members.map((member) => member.date)) }));
    const allPoints = curves.flatMap((curve) => curve.points);
    const firstDay = Math.min(...allPoints.map((point) => point.day));
    const lastDay = Math.max(...allPoints.map((point) => point.day));
    const allDays = Array.from({ length: lastDay - firstDay + 1 }, (_, i) => firstDay + i);
    // La saison en cours s'arrête à son dernier jour d'inscription
    const currentLastDay = curves[0].points.length ? curves[0].points[curves[0].points.length - 1].day : firstDay;
    draw("chart-seasons", {
        type: "line",
        data: {
            labels: allDays.map(seasonDayLabel),
            // Les plus anciennes d'abord : la saison en cours et la précédente sont tracées par-dessus
            datasets: curves.map((curve, index) => ({
                ...line(`Saison ${curve.name}`,
                    stepValues(curve.points, (point) => point.day, allDays).map((count, i) => (index === 0 && allDays[i] > currentLastDay ? null : count)),
                    seasonColor(index, curves.length)),
                borderWidth: index < SERIES.length ? 2 : 1.5,
            })).reverse(),
        },
        options: { scales: axes({ time: true }) },
    }, true);

    draw("chart-totals", {
        type: "bar",
        data: {
            labels: totals.map((total) => (total.season === season ? `${total.season} (en cours)` : total.season)),
            datasets: [
                { label: `Au ${sameDay}`, data: totals.map((total) => total.membersAtSameDay), backgroundColor: SERIES[0], ...bar },
                { label: "En fin de saison", data: totals.map((total) => (total.season === season ? null : total.members)), backgroundColor: ENDED, ...bar },
            ],
        },
        options: { scales: axes() },
    }, true);

    // Saison précédente d'abord (orange), puis la saison en cours (bleu), comme sur la courbe
    draw("chart-months", {
        type: "bar",
        data: {
            labels: [...MONTHS.slice(8), ...MONTHS.slice(0, 8)],
            datasets: [
                { label: `Saison ${previous.season}`, data: bySeasonMonth(previous.season, previous.members), backgroundColor: SERIES[1], ...bar },
                { label: `Saison ${season}`, data: bySeasonMonth(season, invoices), backgroundColor: SERIES[0], ...bar },
            ],
        },
        options: { scales: axes() },
    }, true);

    draw("chart-counts", {
        type: "bar",
        data: {
            labels: ACTIVITY_COUNTS,
            datasets: [
                { label: `Saison ${previous.season} au ${sameDay}`, data: activityCounts(untilSameDay(previous.season, previous.members, season, date)),
                  backgroundColor: SERIES[1], ...bar },
                { label: `Saison ${season}`, data: activityCounts(invoices), backgroundColor: SERIES[0], ...bar },
            ],
        },
        options: { scales: axes() },
    }, true);
}

// Sous-onglet « Comparaison des saisons par activité » : tableau des adhérents de chaque activité saison par saison,
// puis un petit graphe par activité, tous à la même échelle pour pouvoir les comparer
export async function renderActivityStats(container: HTMLElement, season: string, invoices: Invoice[], history: SeasonHistory[]) {
    const current = reset();
    const date = today();
    const table = activitiesBySeason([{ season, members: invoices }, ...history], date);
    const max = Math.max(1, ...table.rows.flatMap((row) => row.counts));
    // Cellule teintée de bleu, d'autant plus foncé que l'effectif est grand
    const cell = (count: number) => `<td style="background:rgba(42,120,214,${(0.08 + 0.5 * count / max).toFixed(2)})">${count}</td>`;
    const change = (value: number | null) => value === null ? "" : value > 0 ? `▲ +${value}` : value < 0 ? `▼ ${value}` : "=";
    const sameDay = `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

    container.innerHTML = `
      <section class="stats-block">
        <h3>Adhérents par activité et par saison</h3>
        <table class="by-season">
          <thead><tr><th>Activité</th>${table.seasons.map((name) => `<th>${escape(name)}${name === season ? " (en cours)" : ""}</th>`).join("")}
            ${table.previousSeason ? `<th>Écart avec la saison ${escape(table.previousSeason)} au même jour (${sameDay})</th>` : ""}</tr></thead>
          <tbody>${table.rows.map((row) => `<tr><td>${escape(row.name)}</td>${row.counts.map(cell).join("")}
            ${table.previousSeason ? `<td title="${row.previousAtSameDay} adhérent(s) au ${sameDay} de la saison ${escape(table.previousSeason)}">${change(row.change)}</td>` : ""}</tr>`).join("")}
          </tbody>
        </table>
        ${table.previousSeason ? `<p class="note">La saison en cours n'est pas terminée : l'écart la compare à la saison ${escape(table.previousSeason)}
          à la même date de saison (${sameDay}), et non à toute la saison ${escape(table.previousSeason)}.</p>` : ""}
      </section>

      <section class="stats-block">
        <h3>Évolution de chaque activité</h3>
        <p class="note">Même échelle pour toutes les activités. La saison en cours, pas terminée, est en bleu clair.</p>
        <div class="small-multiples">${table.rows.map((row, index) => `
          <div><h4>${escape(row.name)}</h4><div class="chart" style="height:11rem"><canvas id="chart-activity-${index}" aria-label="${escape(row.name)} par saison"></canvas></div></div>`).join("")}
        </div>
      </section>`;

    if (!await loadChartJs(current))
        return;
    table.rows.forEach((row, index) => draw(`chart-activity-${index}`, {
        type: "bar",
        data: { labels: table.seasons, datasets: [{ label: "Adhérents", data: row.counts, backgroundColor: seasonBars(table.seasons, season), ...bar }] },
        // Même échelle pour toutes les activités
        options: { scales: { ...axes(), y: { ...axes().y, max } } },
    }));
}
