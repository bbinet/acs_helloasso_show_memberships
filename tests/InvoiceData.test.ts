import { describe, expect, it } from "vitest";
import { buildInvoice, summarize } from "../src/InvoiceData.js";

// Adhésion telle que renvoyée par l'API HelloAsso (/forms/.../items?withDetails=true)
const item = () => ({
    id: 12345,
    name: "Adhésion à l'ACS",
    amount: 2000,
    user: { firstName: "jean-pierre ", lastName: "de la fontaine" },
    payer: { email: "jp.fontaine@example.com" },
    order: { id: 999, date: "2024-09-15T10:30:00+02:00", formName: "Adhésion ACS 2024-2025" },
    customFields: [
        { name: "Société", answer: "Ma Petite Entreprise" },
        { name: "Téléphone", answer: "06 12 34 56 78" },
    ],
    options: [
        { name: "Football", amount: 1500 },
        { name: "Tennis", amount: 0 },
        { name: "N'oubliez pas votre certificat médical", amount: 0 },
    ],
    payments: [{ amount: 3500, refundOperations: [] }],
});

describe("buildInvoice", () => {
    it("reprend le numéro, la date de paiement, l'objet et le payeur de l'adhésion", () => {
        const invoice = buildInvoice(item());
        expect(invoice).toMatchObject({
            id: 12345,
            date: "2024-09-15",
            object: "Adhésion ACS 2024-2025",
            firstName: "Jean-Pierre",
            lastName: "De La Fontaine",
            company: "MA PETITE ENTREPRISE",
            email: "jp.fontaine@example.com",
        });
    });

    it("facture la formule et les options en euros, sans l'option « N'oubliez pas »", () => {
        const invoice = buildInvoice(item());
        expect(invoice.lines).toEqual([
            { label: "Adhésion à l'ACS", amount: 20 },
            { label: "Football", amount: 15 },
            { label: "Tennis", amount: 0 },
        ]);
        expect(invoice.total).toBe(35);
    });

    it("garde les centimes", () => {
        const invoice = buildInvoice({ ...item(), amount: 1250, options: [{ name: "Yoga", amount: 799 }] });
        expect(invoice.total).toBe(20.49);
    });

    it("ne facture pas une adhésion remboursée", () => {
        const refunded = { ...item(), payments: [{ amount: 3500, refundOperations: [{ id: 1, amount: 3500 }] }] };
        expect(buildInvoice(refunded)).toBeNull();
    });

    it("ne facture pas une adhésion anonymisée par HelloAsso", () => {
        const { user: _, ...anonymised } = item();
        expect(buildInvoice(anonymised)).toBeNull();
    });

    it("liste les activités choisies, sans l'option « N'oubliez pas »", () => {
        expect(buildInvoice(item())!.activities).toEqual(["Football", "Tennis"]);
        expect(buildInvoice({ ...item(), options: undefined })!.activities).toEqual([]);
    });

    it("garde le nom du tarif choisi, quel qu'il soit", () => {
        expect(buildInvoice(item())!.formula).toBe("Adhésion à l'ACS");
        expect(buildInvoice({ ...item(), name: "Adhésion avec accès à la salle Emile Allais" })!.formula).toBe("Adhésion avec accès à la salle Emile Allais");
    });

    it("garde le téléphone de l'adhérent, s'il l'a donné", () => {
        expect(buildInvoice(item())!.phone).toBe("06 12 34 56 78");
        expect(buildInvoice({ ...item(), customFields: [{ name: "Société", answer: "X" }] })!.phone).toBe("");
    });

});

describe("summarize", () => {
    it("ne garde d'une adhésion que la date, les activités, le tarif et le montant : aucune donnée personnelle", () => {
        expect(summarize(buildInvoice(item())!)).toEqual({
            date: "2024-09-15",
            activities: ["Football", "Tennis"],
            formula: "Adhésion à l'ACS",
            total: 35,
        });
    });
});
