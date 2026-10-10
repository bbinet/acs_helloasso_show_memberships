// Données d'une facture, extraites d'une adhésion renvoyée par l'API HelloAsso.
// Utilisé par ACSData.js (node, à la récupération des données) : en JavaScript pour être importable sans compilation.

/** "jean-pierre " => "Jean-Pierre" */
export function title(str) {
    return str.trim().toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());
}

/**
 * @typedef {{ label: string, amount: number }} InvoiceLine  montant en euros
 * @typedef {{
 *   id: number, date: string, object: string,
 *   firstName: string, lastName: string, company: string, email: string,
 *   lines: InvoiceLine[], total: number,
 *   activities: string[], formula: string,
 * }} Invoice
 */

/** Adhésion remboursée, ou anonymisée par HelloAsso (pas d'adhérent) : rien à facturer */
export function isBillable(item) {
    return Boolean(item.user) && !(item.payments && item.payments[0].refundOperations.length > 0);
}

/** @returns {Invoice | null} */
export function buildInvoice(item) {
    if (!isBillable(item))
        return null;
    const company = (item.customFields ?? []).find((field) => field.name == "Société");
    // Montants HelloAsso en centimes. L'option « N'oubliez pas ... » n'est qu'un rappel, pas une prestation.
    const options = (item.options ?? []).filter((option) => !option.name.includes("oubliez pas"));
    const lines = [{ label: item.name, cents: item.amount }]
        .concat(options.map((option) => ({ label: option.name, cents: option.amount ?? 0 })));
    return {
        id: item.id,
        date: item.order.date.split("T")[0],
        object: item.order.formName,
        firstName: title(item.user.firstName),
        lastName: title(item.user.lastName),
        company: (company?.answer ?? "").toUpperCase(),
        email: item.payer.email,
        lines: lines.map(({ label, cents }) => ({ label, amount: cents / 100 })),
        total: lines.reduce((sum, { cents }) => sum + cents, 0) / 100,
        activities: options.map((option) => option.name),
        // Tarif choisi (par exemple avec ou sans accès à la salle Émile Allais) : son nom tel que dans HelloAsso
        formula: item.name,
    };
}
