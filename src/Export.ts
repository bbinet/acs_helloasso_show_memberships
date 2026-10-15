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

// Destinataire d'un mail : une facture, ou une ligne de la liste des adhérents (voir memberContacts)
export type Contact = Pick<Invoice, "firstName" | "lastName" | "email">;

// Un destinataire par adresse email (un payeur peut avoir réglé plusieurs adhésions)
export function uniqueByEmail<T extends Contact>(contacts: T[]): T[] {
    const seen = new Set<string>();
    return contacts.filter((contact) => !seen.has(contact.email) && seen.add(contact.email));
}

// « "Prénom Nom" <email>, ... », une seule fois par adresse
export function emailList(contacts: Contact[]): string {
    return uniqueByEmail(contacts)
        .map((contact) => `"${`${contact.firstName} ${contact.lastName}`.replace(/"/g, "")}" <${contact.email}>`)
        .join(", ");
}

// Destinataires des lignes de la liste des adhérents (champs « Prénom », « Nom » et « Email » de acs.json)
export const memberContacts = (rows: Record<string, string>[]): Contact[] =>
    rows.map((row) => ({ firstName: row["Prénom"], lastName: row["Nom"], email: row["Email"] }));
