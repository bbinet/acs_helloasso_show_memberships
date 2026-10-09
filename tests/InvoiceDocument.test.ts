import { describe, expect, it } from "vitest";
import { invoiceDocument } from "../src/InvoiceDocument";
import type { Invoice } from "../src/InvoiceData.js";

const invoice: Invoice = {
    id: 12345,
    date: "2024-09-15",
    object: "Adhésion ACS 2024-2025",
    firstName: "Jean-Pierre",
    lastName: "De La Fontaine",
    company: "MA PETITE ENTREPRISE",
    email: "jp.fontaine@example.com",
    lines: [
        { label: "Adhésion à l'ACS", amount: 20 },
        { label: "Football", amount: 15.5 },
    ],
    total: 35.5,
};

const issuer = { name: "Nathalie Baillet", title: "Trésorière, membre du CA de l'ACS", email: "acs.tresorier@gmail.com" };

// Tous les textes du document, quelle que soit leur mise en page
const texts = (node: unknown): string[] => {
    if (typeof node === "string")
        return node ? [node] : [];
    if (Array.isArray(node))
        return node.flatMap(texts);
    if (node && typeof node === "object")
        return Object.entries(node).flatMap(([key, value]) => ["text", "content", "stack", "columns", "table", "body", "header", "footer"].includes(key) ? texts(value) : []);
    return [];
};
const content = (doc: unknown) => texts(doc).join("\n");

describe("invoiceDocument", () => {
    it("indique le numéro de facture, le destinataire et la date d'émission", () => {
        const text = content(invoiceDocument(invoice, { issuedOn: new Date("2026-10-09T12:00:00Z"), issuer }));
        expect(text).toContain("Facture n°12345");
        expect(text).toContain("A l’attention de Jean-Pierre De La Fontaine");
        expect(text).toContain("Le Bourget du Lac, le 09/10/2026");
        expect(text).toContain("Adhésion ACS 2024-2025");
    });

    it("détaille les lignes en euros, le total à payer et la date de paiement", () => {
        const text = content(invoiceDocument(invoice, { issuedOn: new Date("2026-10-09T12:00:00Z"), issuer }));
        expect(text).toMatch(/Adhésion à l'ACS\n20,00 €\n1\n20,00 €/);
        expect(text).toMatch(/Football\n15,50 €\n1\n15,50 €/);
        expect(text).toMatch(/Total à payer :\n35,50 €/);
        expect(text).toContain("Payé le 15/09/2024.");
    });

    it("nomme l'interlocuteur et le signataire, avec sa signature si elle est fournie", () => {
        const signature = "data:image/png;base64,iVBORw0KGgo=";
        const doc = invoiceDocument(invoice, { issuedOn: new Date("2026-10-09T12:00:00Z"), issuer, signature });
        const text = content(doc);
        expect(text).toContain("Nathalie Baillet – acs.tresorier@gmail.com");
        expect(text).toMatch(/Etabli par Nathalie Baillet\nTrésorière, membre du CA de l'ACS/);
        expect(JSON.stringify(doc)).toContain(signature);
    });

    it("se passe de signature si elle n'est pas fournie", () => {
        const doc = invoiceDocument(invoice, { issuedOn: new Date("2026-10-09T12:00:00Z"), issuer });
        expect(JSON.stringify(doc)).not.toContain("data:image");
    });
});
