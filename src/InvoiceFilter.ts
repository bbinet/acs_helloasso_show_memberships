// Filtres de la liste des adhésions de la page admin
import type { Invoice } from "./InvoiceData.js";
import { statusCategory, type InvoiceStatus, type StatusCategory } from "./InvoiceService";

// Valeur du filtre d'activité pour les adhérents qui n'en ont choisi aucune
export const NO_ACTIVITY = "[Aucune activité]";

export interface FilterCriteria {
    search?: string;
    status?: "" | StatusCategory;
    activity?: string;
    // Période d'inscription, bornes comprises (AAAA-MM-JJ)
    from?: string;
    to?: string;
    formula?: string;
}

// Minuscules et sans accents : « Bérard » est trouvé en cherchant « berard »
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const activityMatches = (invoice: Invoice, activity: string | undefined) => {
    if (!activity)
        return true;
    if (activity === NO_ACTIVITY)
        return invoice.activities.length === 0;
    return invoice.activities.includes(activity);
};

export function filterInvoices(invoices: Invoice[], statuses: Record<string, InvoiceStatus>, criteria: FilterCriteria): Invoice[] {
    const search = normalize(criteria.search?.trim() ?? "");
    return invoices.filter((invoice) =>
        (!search || normalize(`${invoice.id} ${invoice.firstName} ${invoice.lastName} ${invoice.company} ${invoice.email}`).includes(search))
        && (!criteria.status || statusCategory(statuses[invoice.id]) === criteria.status)
        && activityMatches(invoice, criteria.activity)
        && (!criteria.from || invoice.date >= criteria.from)
        && (!criteria.to || invoice.date <= criteria.to)
        && (!criteria.formula || invoice.formula === criteria.formula));
}
