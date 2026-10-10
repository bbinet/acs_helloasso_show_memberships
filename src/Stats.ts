// Calculs des statistiques de la page admin, à partir des adhésions et du registre des envois
import type { Invoice } from "./InvoiceData.js";
import { statusCategory, type InvoiceStatus } from "./InvoiceService";
import { NO_ACTIVITY } from "./InvoiceFilter";

type Statuses = Record<string, InvoiceStatus>;

// Somme en centimes, pour éviter les erreurs d'arrondi des nombres à virgule
const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + Math.round(amount * 100), 0) / 100;

const sendingCounts = (invoices: Invoice[], statuses: Statuses) => {
    const counts = { sent: 0, todo: 0, problems: 0 };
    for (const invoice of invoices) {
        const category = statusCategory(statuses[invoice.id]);
        counts[category === "problem" ? "problems" : category]++;
    }
    return counts;
};

// Regroupe les adhésions selon une ou plusieurs clés chacune (un adhérent compte dans chacune de ses activités)
const groupBy = (invoices: Invoice[], keys: (invoice: Invoice) => string[]) => {
    const groups = new Map<string, Invoice[]>();
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

export function keyFigures(invoices: Invoice[], statuses: Statuses) {
    return {
        members: invoices.length,
        revenue: sum(invoices.map((invoice) => invoice.total)),
        ...sendingCounts(invoices, statuses),
    };
}

export interface ActivityGroup {
    name: string;
    count: number;
    revenue: number; // recettes des options de cette activité
    sent: number;
    todo: number;
    problems: number;
    members: Invoice[];
}

// Adhérents par activité (un adhérent compte dans chacune de ses activités), sans activité en dernier
export function byActivity(invoices: Invoice[], statuses: Statuses): ActivityGroup[] {
    return groupBy(invoices, (invoice) => (invoice.activities.length ? invoice.activities : [NO_ACTIVITY]))
        .map(([name, members]) => ({
            name,
            count: members.length,
            revenue: sum(members.flatMap((m) => m.lines.filter((line) => line.label === name).map((line) => line.amount))),
            ...sendingCounts(members, statuses),
            members,
        }))
        .sort((a, b) => Number(a.name === NO_ACTIVITY) - Number(b.name === NO_ACTIVITY) || b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

// Adhérents et recettes (prix du tarif seul, sans les options) de chaque tarif, du plus choisi au moins choisi
export function byFormula(invoices: Invoice[]) {
    return groupBy(invoices, (invoice) => [invoice.formula])
        .map(([name, members]) => ({ name, count: members.length, revenue: sum(members.map((m) => m.lines[0].amount)) }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

// Inscriptions par mois ("2026-09"), du premier au dernier mois, y compris les mois sans inscription
export function byMonth(invoices: Invoice[]) {
    if (invoices.length === 0)
        return [];
    const months = invoices.map((invoice) => invoice.date.slice(0, 7)).sort();
    const result: { month: string; count: number }[] = [];
    let [year, month] = months[0].split("-").map(Number);
    for (let current = months[0]; current <= months[months.length - 1];) {
        result.push({ month: current, count: months.filter((m) => m === current).length });
        [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
        current = `${year}-${String(month).padStart(2, "0")}`;
    }
    return result;
}

// Nombre d'adhérents sans activité, avec 1, 2, puis 3 activités et plus
export function activityCounts(invoices: Invoice[]): [number, number, number, number] {
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

// Adhésions d'une saison, résumées (voir summarize) : la saison en cours peut passer ses factures telles quelles
export interface SeasonMembers {
    season: string;
    members: { date: string; activities: string[]; total: number }[];
}

// Jour de saison d'une date (« AAAA-MM-JJ »), compté depuis le 1er juillet de la première année de la saison
export const seasonDay = (season: string, date: string) =>
    Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(Number(season.slice(0, 4)), 6, 1)) / DAY);
