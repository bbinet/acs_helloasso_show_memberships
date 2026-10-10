// Calculs des statistiques de la page admin, à partir des adhésions et du registre des envois
import type { Invoice } from "./InvoiceData.js";
import { statusCategory, type InvoiceStatus } from "./InvoiceService";
import { NO_ACTIVITY } from "./InvoiceFilter";

type Statuses = Record<string, InvoiceStatus>;

// Somme en centimes, pour éviter les erreurs d'arrondi des nombres à virgule
const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + Math.round(amount * 100), 0) / 100;

// Adhésion de n'importe quelle saison : facture complète (saison en cours) ou résumé sans donnée personnelle
// (saisons archivées, voir summarize)
export type Member = Pick<Invoice, "date" | "activities" | "formula" | "lines" | "total">;

// Adhésions d'une saison (« 2026-2027 »)
export interface SeasonMembers {
    season: string;
    members: Member[];
}

// Factures envoyées, à envoyer et en erreur (saison en cours seulement : seule à avoir des statuts d'envoi)
export function sendingCounts(invoices: Invoice[], statuses: Statuses) {
    const counts = { sent: 0, todo: 0, problems: 0 };
    for (const invoice of invoices) {
        const category = statusCategory(statuses[invoice.id]);
        counts[category === "problem" ? "problems" : category]++;
    }
    return counts;
}

// Regroupe les adhésions selon une ou plusieurs clés chacune (un adhérent compte dans chacune de ses activités)
const groupBy = <T extends Member>(invoices: T[], keys: (invoice: T) => string[]) => {
    const groups = new Map<string, T[]>();
    for (const invoice of invoices)
        for (const key of keys(invoice)) {
            const group = groups.get(key);
            if (group)
                group.push(invoice);
            else
                groups.set(key, [invoice]);
        }
    return [...groups.entries()];
};

// Nombre d'adhérents et montant encaissé
export function keyFigures(members: Member[]) {
    return { members: members.length, revenue: sum(members.map((member) => member.total)) };
}

// Activités d'un adhérent, ou NO_ACTIVITY s'il n'en a pas
const activitiesOf = (member: Member) => (member.activities.length ? member.activities : [NO_ACTIVITY]);

export interface ActivityGroup<T extends Member = Invoice> {
    name: string;
    count: number;
    revenue: number; // recettes des options de cette activité
    members: T[];
}

// Adhérents par activité (un adhérent compte dans chacune de ses activités), sans activité en dernier
export function byActivity<T extends Member>(invoices: T[]): ActivityGroup<T>[] {
    return groupBy(invoices, activitiesOf)
        .map(([name, members]) => ({
            name,
            count: members.length,
            revenue: sum(members.flatMap((m) => m.lines.filter((line) => line.label === name).map((line) => line.amount))),
            members,
        }))
        .sort((a, b) => Number(a.name === NO_ACTIVITY) - Number(b.name === NO_ACTIVITY) || b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

// Adhérents et recettes (prix du tarif seul, sans les options) de chaque tarif, du plus choisi au moins choisi
export function byFormula(invoices: Member[]) {
    return groupBy(invoices, (invoice) => [invoice.formula])
        .map(([name, members]) => ({ name, count: members.length, revenue: sum(members.map((m) => m.lines[0].amount)) }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

// Nombre d'adhérents sans activité, avec 1, 2, puis 3 activités et plus
export function activityCounts(invoices: { activities: string[] }[]): [number, number, number, number] {
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    for (const invoice of invoices)
        counts[Math.min(invoice.activities.length, 3)]++;
    return counts;
}

// Nombre cumulé d'inscriptions (ou d'envois) à chaque jour où il y en a eu
export function cumulative(dates: string[]) {
    const result: { date: string; count: number }[] = [];
    [...dates].sort().forEach((date, index) => {
        if (result.length && result[result.length - 1].date === date)
            result[result.length - 1].count = index + 1;
        else
            result.push({ date, count: index + 1 });
    });
    return result;
}

const DAY = 24 * 60 * 60 * 1000;

// Courbe cumulée d'une saison (« 2026-2027 »), en jours depuis le 1er juillet de sa première année :
// les saisons peuvent ainsi être superposées sur un même graphe
export function seasonCurve(season: string, dates: string[]) {
    return cumulative(dates).map(({ date, count }) => ({ day: seasonDay(season, date), count }));
}

// Jour de saison d'une date (« AAAA-MM-JJ »), compté depuis le 1er juillet de la première année de la saison
const seasonDay = (season: string, date: string) =>
    Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(Number(season.slice(0, 4)), 6, 1)) / DAY);

// Adhésions d'une saison inscrites au plus tard au même jour de saison qu'aujourd'hui (« AAAA-MM-JJ ») dans la
// saison en cours : pour comparer une saison passée à la saison en cours, qui n'est pas terminée
export const untilSameDay = <T extends { date: string }>(season: string, members: T[], currentSeason: string, today: string) => {
    const lastDay = seasonDay(currentSeason, today);
    return members.filter((member) => seasonDay(season, member.date) <= lastDay);
};

// Adhérents et montant encaissé de chaque saison (données de la plus récente à la plus ancienne), en fin de saison
// et au même jour de saison qu'aujourd'hui (« AAAA-MM-JJ »), de la plus ancienne à la plus récente
export function totalsBySeason(seasons: SeasonMembers[], today: string) {
    const currentSeason = seasons[0].season;
    return [...seasons].reverse().map(({ season, members }) => {
        const atSameDay = keyFigures(untilSameDay(season, members, currentSeason, today));
        return {
            season,
            current: season === currentSeason,
            ...keyFigures(members),
            membersAtSameDay: atSameDay.members,
            revenueAtSameDay: atSameDay.revenue,
        };
    });
}

// Inscriptions de chaque mois de la saison, de septembre (0) à août (11) : une inscription faite avant septembre
// compte en septembre, après août en août
export function bySeasonMonth(season: string, members: { date: string }[]) {
    const counts = Array<number>(12).fill(0);
    const firstYear = Number(season.slice(0, 4));
    for (const { date } of members) {
        const index = (Number(date.slice(0, 4)) - firstYear) * 12 + Number(date.slice(5, 7)) - 9;
        counts[Math.min(11, Math.max(0, index))]++;
    }
    return counts;
}

const countActivities = (members: Member[]) => new Map(groupBy(members, activitiesOf).map(([name, group]) => [name, group.length]));

// Adhérents par activité et par saison (de la plus ancienne à la plus récente), et comparaison de la saison
// en cours avec la précédente au même jour de saison qu'aujourd'hui (« AAAA-MM-JJ »)
export function activitiesBySeason(seasons: SeasonMembers[], today: string) {
    const ordered = [...seasons].reverse();
    const counts = ordered.map(({ members }) => countActivities(members));
    const [current, previous] = seasons;
    const sameDay = previous ? countActivities(untilSameDay(previous.season, previous.members, current.season, today)) : null;
    const names = [...new Set(counts.flatMap((count) => [...count.keys()]))];
    const currentCounts = counts[counts.length - 1];
    const previousCounts = counts.length > 1 ? counts[counts.length - 2] : new Map<string, number>();
    return {
        seasons: ordered.map(({ season }) => season),
        previousSeason: previous?.season ?? null,
        rows: names
            .map((name) => {
                const previousAtSameDay = sameDay ? sameDay.get(name) ?? 0 : null;
                return {
                    name,
                    counts: counts.map((count) => count.get(name) ?? 0),
                    previousAtSameDay,
                    change: previousAtSameDay === null ? null : (currentCounts.get(name) ?? 0) - previousAtSameDay,
                };
            })
            .sort((a, b) => Number(a.name === NO_ACTIVITY) - Number(b.name === NO_ACTIVITY)
                || (currentCounts.get(b.name) ?? 0) - (currentCounts.get(a.name) ?? 0)
                || (previousCounts.get(b.name) ?? 0) - (previousCounts.get(a.name) ?? 0)
                || a.name.localeCompare(b.name, "fr")),
    };
}
