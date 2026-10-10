// Onglets « Statistiques » et « Statistiques par activité » de la page admin : chiffres clés, tableaux et graphes
// (Chart.js, chargé depuis jsDelivr)
import type { Chart as ChartJs, ChartConfiguration } from "chart.js";
import type { Invoice } from "./InvoiceData.js";
import { statusCategory, type InvoiceStatus } from "./InvoiceService";
import { loadScript } from "./loadScript";
import { escape, euros } from "./format";
import { activitiesBySeason, activityCounts, byActivity, byFormula, byMonth, cumulative, keyFigures, seasonCurve, totalsBySeason,
         type SeasonMembers } from "./Stats";

const CHARTJS = {
    src: "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js",
    integrity: "sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ",
};

// Couleurs : une série = bleu ; saison en cours et saison précédente = bleu et orange (palette validée pour les
// daltoniens), saisons plus anciennes en gris ; statuts d'envoi = vert (envoyée), gris (à envoyer), rouge (en erreur)
const SERIES = ["#2a78d6", "#eb6834"];
const STATUS = { sent: "#0ca30c", todo: "#c3c2b7", problems: "#d03b3b" };
const MUTED = "#898781";
const GRID = "#e1e0d9";
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

type Statuses = Record<string, InvoiceStatus>;
// Saisons archivées, de la plus récente à la plus ancienne
export type SeasonHistory = SeasonMembers;

const shortDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
// Jour de saison (depuis le 1er juillet) => « 15 sept. »
const seasonDayLabel = (day: number) => shortDate(new Date(Date.UTC(2001, 6, 1) + day * 86400000).toISOString().slice(0, 10));

let charts: ChartJs[] = [];

// Axes : valeurs à partir de 0 avec une grille discrète ; catégories sans grille (dates espacées pour les courbes)
const axes = (options: { stacked?: boolean; horizontal?: boolean; time?: boolean } = {}) => {
    const value = { beginAtZero: true, stacked: options.stacked, ticks: { color: MUTED, precision: 0 }, grid: { color: GRID }, border: { display: false } };
    const category = { stacked: options.stacked, ticks: { color: MUTED, ...(options.time && { maxTicksLimit: 12, maxRotation: 0 }) }, grid: { display: false } };
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

// Barres par saison : la saison en cours, pas terminée, en bleu plus clair
const CURRENT = "#8fb8ea";
const seasonBars = (seasons: string[], current: string) => seasons.map((name) => (name === current ? CURRENT : SERIES[0]));

// Aujourd'hui (« AAAA-MM-JJ »), à Paris
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

const bar = { borderRadius: 4, borderSkipped: "start" as const, maxBarThickness: 28 };
const line = (label: string, data: (number | null)[], color: string, stepped = false) =>
    ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, stepped });
// Segments de barres empilées, séparés par un liseré blanc
const stackedBar = (label: string, data: number[], color: string) =>
    ({ label, data, backgroundColor: color, borderColor: "#fff", borderWidth: { right: 2 } as any, ...bar, borderRadius: 0 });

// Valeur d'une courbe cumulée (points triés) à chaque abscisse demandée (triées), en un seul parcours
const stepValues = <T>(points: (T & { count: number })[], key: (point: T) => string | number, xs: (string | number)[]) => {
    let index = -1;
    return xs.map((x) => {
        while (index + 1 < points.length && key(points[index + 1]) <= x)
            index++;
        return index < 0 ? 0 : points[index].count;
    });
};

export async function renderStats(container: HTMLElement, season: string, invoices: Invoice[], statuses: Statuses, history: SeasonHistory[]) {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    const figures = keyFigures(invoices, statuses);
    const activities = byActivity(invoices, statuses);
    const formulas = byFormula(invoices);
    const months = byMonth(invoices);
    const counts = activityCounts(invoices);
    const activitiesHeight = `${Math.max(12, activities.length * 2.2)}rem`;
    const tile = (value: string | number, label: string) => `<div class="tile"><div class="value">${value}</div><div class="label">${label}</div></div>`;
    // Toutes les saisons, de la plus récente (en cours) à la plus ancienne
    const seasons: SeasonMembers[] = [{ season, members: invoices }, ...history];
    const totals = totalsBySeason(seasons);

    container.innerHTML = `
      <div class="tiles">
        ${tile(figures.members, "adhérents")}
        ${tile(euros(figures.revenue), "encaissés")}
        ${tile(figures.sent, "factures envoyées")}
        ${tile(figures.todo, "factures à envoyer")}
        ${tile(figures.problems, "factures en erreur")}
      </div>

      <div class="stats-block">
        <h3>Inscriptions depuis le début de la saison</h3>
        <div class="chart"><canvas id="chart-cumulative" aria-label="Nombre cumulé d'inscriptions et de factures envoyées"></canvas></div>
      </div>

      ${seasons.length > 1 ? `
      <div class="stats-block">
        <h3>Comparaison avec les saisons précédentes</h3>
        <p><small>Nombre cumulé d'inscriptions, au même jour de chaque saison (comptée à partir du 1er juillet).</small></p>
        <div class="chart"><canvas id="chart-seasons" aria-label="Inscriptions cumulées par saison"></canvas></div>
      </div>

      <div class="stats-block">
        <h3>Adhérents par saison</h3>
        <p><small>La saison en cours, pas terminée, est en bleu clair.</small></p>
        <div class="chart" style="height:16rem"><canvas id="chart-totals" aria-label="Adhérents par saison"></canvas></div>
        <table>
          <thead><tr><th>Saison</th><th>Adhérents</th><th>Montant encaissé</th></tr></thead>
          <tbody>${[...totals].reverse().map((total) => `<tr><td>${escape(total.season)}${total.season === season ? " (en cours)" : ""}</td>
            <td>${total.members}</td><td>${euros(total.revenue)}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : ""}

      <div class="stats-block">
        <h3>Adhérents par activité</h3>
        <div class="chart" style="height:${activitiesHeight}"><canvas id="chart-activities" aria-label="Adhérents par activité"></canvas></div>
        <table>
          <thead><tr><th>Activité</th><th>Adhérents</th><th>Recettes des options</th></tr></thead>
          <tbody>${activities.map((group) => `
            <tr>
              <td><details><summary>${escape(group.name)}</summary><ul>${group.members
                  .map((m) => `<li>${escape(m.firstName)} ${escape(m.lastName)}${m.company ? ` (${escape(m.company)})` : ""}</li>`).join("")}</ul></details></td>
              <td>${group.count}</td>
              <td>${euros(group.revenue)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="stats-block">
        <h3>Envoi des factures par activité</h3>
        <div class="chart" style="height:${activitiesHeight}"><canvas id="chart-status" aria-label="Statut des factures par activité"></canvas></div>
      </div>

      <div class="stats-block">
        <h3>Tarifs</h3>
        <table>
          <thead><tr><th>Tarif</th><th>Adhérents</th><th>Recettes du tarif (sans les options)</th></tr></thead>
          <tbody>${formulas.map((formula) => `<tr><td>${escape(formula.name)}</td><td>${formula.count}</td><td>${euros(formula.revenue)}</td></tr>`).join("")}</tbody>
        </table>
      </div>

      <div class="stats-block">
        <h3>Inscriptions par mois</h3>
        <div class="chart"><canvas id="chart-months" aria-label="Inscriptions par mois"></canvas></div>
      </div>

      <div class="stats-block">
        <h3>Nombre d'activités par adhérent</h3>
        <div class="chart" style="height:16rem"><canvas id="chart-counts" aria-label="Nombre d'activités par adhérent"></canvas></div>
      </div>`;

    await loadScript(CHARTJS);

    // Inscriptions et factures envoyées : même unité (nombre d'adhérents), donc un seul axe
    const registered = cumulative(invoices.map((invoice) => invoice.date));
    const sent = cumulative(invoices.map((invoice) => statuses[invoice.id])
        .filter((status) => statusCategory(status) === "sent").map((status) => status.date.slice(0, 10)));
    const days = [...new Set([...registered, ...sent].map((point) => point.date))].sort();
    const byDate = (point: { date: string }) => point.date;
    draw("chart-cumulative", {
        type: "line",
        data: {
            labels: days.map(shortDate),
            datasets: [
                line("Inscriptions", stepValues(registered, byDate, days), SERIES[0], true),
                line("Factures envoyées", stepValues(sent, byDate, days), SERIES[1], true),
            ],
        },
        options: { scales: axes({ time: true }) },
    }, true);

    if (seasons.length > 1) {
        const curves = seasons.map(({ season: name, members }) => ({ name, points: seasonCurve(name, members.map((member) => member.date)) }));
        const allPoints = curves.flatMap((curve) => curve.points);
        const firstDay = Math.min(0, ...allPoints.map((point) => point.day));
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
                datasets: [{ label: "Adhérents", data: totals.map((total) => total.members), backgroundColor: seasonBars(totals.map((total) => total.season), season), ...bar }],
            },
            options: { scales: axes() },
        });
    }

    const names = activities.map((group) => group.name);
    draw("chart-activities", {
        type: "bar",
        data: { labels: names, datasets: [{ label: "Adhérents", data: activities.map((group) => group.count), backgroundColor: SERIES[0], ...bar }] },
        options: { indexAxis: "y", scales: axes({ horizontal: true }), interaction: { mode: "nearest", axis: "y", intersect: false } },
    });

    draw("chart-status", {
        type: "bar",
        data: {
            labels: names,
            datasets: [
                stackedBar("Envoyées", activities.map((group) => group.sent), STATUS.sent),
                stackedBar("À envoyer", activities.map((group) => group.todo), STATUS.todo),
                stackedBar("En erreur", activities.map((group) => group.problems), STATUS.problems),
            ],
        },
        options: { indexAxis: "y", scales: axes({ stacked: true, horizontal: true }), interaction: { mode: "index", axis: "y", intersect: false } },
    }, true);

    draw("chart-months", {
        type: "bar",
        data: {
            labels: months.map(({ month }) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`),
            datasets: [{ label: "Inscriptions", data: months.map(({ count }) => count), backgroundColor: SERIES[0], ...bar }],
        },
        options: { scales: axes() },
    });

    draw("chart-counts", {
        type: "bar",
        data: {
            labels: ["Aucune activité", "1 activité", "2 activités", "3 activités et plus"],
            datasets: [{ label: "Adhérents", data: counts, backgroundColor: SERIES[0], ...bar }],
        },
        options: { scales: axes() },
    });
}

// Onglet « Statistiques par activité » : tableau des adhérents de chaque activité saison par saison,
// puis un petit graphe par activité, tous à la même échelle pour pouvoir les comparer
export async function renderActivityStats(container: HTMLElement, season: string, invoices: Invoice[], history: SeasonHistory[]) {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    const date = today();
    const table = activitiesBySeason([{ season, members: invoices }, ...history], date);
    const max = Math.max(1, ...table.rows.flatMap((row) => row.counts));
    // Cellule teintée de bleu, d'autant plus foncé que l'effectif est grand
    const cell = (count: number) => `<td style="background:rgba(42,120,214,${(0.08 + 0.5 * count / max).toFixed(2)})">${count}</td>`;
    const change = (value: number | null) => value === null ? "" : value > 0 ? `▲ +${value}` : value < 0 ? `▼ ${value}` : "=";
    const sameDay = `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

    container.innerHTML = `
      <div class="stats-block">
        <h3>Adhérents par activité et par saison</h3>
        <table class="by-season">
          <thead><tr><th>Activité</th>${table.seasons.map((name) => `<th>${escape(name)}${name === season ? " (en cours)" : ""}</th>`).join("")}
            ${table.previousSeason ? `<th>Écart avec la saison ${escape(table.previousSeason)} au même jour (${sameDay})</th>` : ""}</tr></thead>
          <tbody>${table.rows.map((row) => `<tr><td>${escape(row.name)}</td>${row.counts.map(cell).join("")}
            ${table.previousSeason ? `<td title="${row.previousAtSameDay} adhérent(s) au ${sameDay} de la saison ${escape(table.previousSeason)}">${change(row.change)}</td>` : ""}</tr>`).join("")}
          </tbody>
        </table>
        ${table.previousSeason ? `<p><small>La saison en cours n'est pas terminée : l'écart la compare à la saison ${escape(table.previousSeason)}
          à la même date de saison (${sameDay}), et non à toute la saison ${escape(table.previousSeason)}.</small></p>` : ""}
      </div>

      <div class="stats-block">
        <h3>Évolution de chaque activité</h3>
        <p><small>Même échelle pour toutes les activités. La saison en cours, pas terminée, est en bleu clair.</small></p>
        <div class="small-multiples">${table.rows.map((row, index) => `
          <div><h4>${escape(row.name)}</h4><div class="chart" style="height:11rem"><canvas id="chart-activity-${index}" aria-label="${escape(row.name)} par saison"></canvas></div></div>`).join("")}
        </div>
      </div>`;

    await loadScript(CHARTJS);
    table.rows.forEach((row, index) => draw(`chart-activity-${index}`, {
        type: "bar",
        data: { labels: table.seasons, datasets: [{ label: "Adhérents", data: row.counts, backgroundColor: seasonBars(table.seasons, season), ...bar }] },
        // Même échelle pour toutes les activités
        options: { scales: { ...axes(), y: { ...axes().y, max } } },
    }));
}
