// Adhésions fictives, au format produit par buildInvoice
import type { Invoice } from "../src/InvoiceData.js";

export const invoice = (id: number, overrides: Partial<Invoice> = {}): Invoice => ({
    id,
    date: "2026-09-15",
    object: "Adhésion ACS 2026-2027",
    firstName: "Jean",
    lastName: "Dupont",
    company: "ACME",
    email: `adherent${id}@example.com`,
    lines: [{ label: "Adhésion à l'ACS", amount: 20 }],
    total: 20,
    activities: [],
    formula: "Adhésion à l'ACS",
    ...overrides,
});
