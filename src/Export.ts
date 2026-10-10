// Exports de la liste filtrée de la page admin : CSV pour un tableur, et liste d'emails à coller dans un mail
import type { Invoice } from "./InvoiceData.js";
import type { InvoiceStatus } from "./InvoiceService";
import { frenchDate } from "./format";

// Champ entre guillemets s'il contient le séparateur, des guillemets ou un retour à la ligne
const field = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// CSV lisible directement par Excel : BOM UTF-8 (accents), séparateur « ; », montants avec une virgule
export function toCsv(invoices: Invoice[], statuses: Record<string, InvoiceStatus>): string {
    const header = ["N°", "Payée le", "Prénom", "Nom", "Entreprise", "Email", "Téléphone", "Tarif", "Activités", "Montant", "Envoi", "Envoyée le"];
    const rows = invoices.map((invoice) => {
        const status = statuses[invoice.id];
        return [
            String(invoice.id), frenchDate(invoice.date), invoice.firstName, invoice.lastName, invoice.company, invoice.email, invoice.phone,
            invoice.formula, invoice.activities.join(", "), invoice.total.toFixed(2).replace(".", ","),
            status?.status ?? "", status ? frenchDate(status.date) : "",
        ];
    });
    return "﻿" + [header, ...rows].map((row) => row.map(field).join(";")).join("\r\n");
}

// Une adhésion par adresse email (un payeur peut avoir réglé plusieurs adhésions)
export function uniqueByEmail(invoices: Invoice[]): Invoice[] {
    const seen = new Set<string>();
    return invoices.filter((invoice) => !seen.has(invoice.email) && seen.add(invoice.email));
}

// « "Prénom Nom" <email>, ... », une seule fois par adresse
export function emailList(invoices: Invoice[]): string {
    return uniqueByEmail(invoices)
        .map((invoice) => `"${`${invoice.firstName} ${invoice.lastName}`.replace(/"/g, "")}" <${invoice.email}>`)
        .join(", ");
}
