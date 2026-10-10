import { describe, expect, it } from "vitest";
import { filterInvoices, NO_ACTIVITY } from "../src/InvoiceFilter";
import { invoice } from "./fixtures";

const ids = (list: { id: number }[]) => list.map((i) => i.id);

describe("filterInvoices", () => {
    const invoices = [
        invoice(1, { firstName: "Marie", lastName: "Durand", company: "SOPRA", activities: ["Football", "Tennis"], date: "2026-09-02" }),
        invoice(2, { firstName: "Paul", lastName: "Martin", email: "paul@example.com", activities: ["Tennis"], date: "2026-10-05", formula: "Adhésion avec salle Emile Allais" }),
        invoice(3, { activities: [], date: "2026-11-20" }),
    ];
    const sent = { status: "envoyée" as const, date: "2026-10-01T10:00:00Z", name: "", email: "", detail: "" };
    const statuses = { "1": sent, "2": { ...sent, status: "non distribuée" as const } };

    it("cherche dans le n°, le nom, l'entreprise et l'email, sans tenir compte des majuscules ni des accents", () => {
        expect(ids(filterInvoices(invoices, statuses, { search: "durand" }))).toEqual([1]);
        expect(ids(filterInvoices(invoices, statuses, { search: "sopra" }))).toEqual([1]);
        expect(ids(filterInvoices(invoices, statuses, { search: "PAUL@" }))).toEqual([2]);
        expect(ids(filterInvoices(invoices, statuses, { search: "3" }))).toEqual([3]);
        expect(ids(filterInvoices([invoice(4, { lastName: "Bérard" })], {}, { search: "berard" }))).toEqual([4]);
    });

    it("filtre sur le statut d'envoi : à envoyer, envoyées, en erreur", () => {
        expect(ids(filterInvoices(invoices, statuses, { status: "todo" }))).toEqual([3]);
        expect(ids(filterInvoices(invoices, statuses, { status: "sent" }))).toEqual([1]);
        expect(ids(filterInvoices(invoices, statuses, { status: "problem" }))).toEqual([2]);
    });

    it("filtre sur une activité, ou sur les adhérents sans activité", () => {
        expect(ids(filterInvoices(invoices, statuses, { activity: "Tennis" }))).toEqual([1, 2]);
        expect(ids(filterInvoices(invoices, statuses, { activity: "Football" }))).toEqual([1]);
        expect(ids(filterInvoices(invoices, statuses, { activity: NO_ACTIVITY }))).toEqual([3]);
    });

    it("filtre sur la période d'inscription, bornes comprises", () => {
        expect(ids(filterInvoices(invoices, statuses, { from: "2026-10-01" }))).toEqual([2, 3]);
        expect(ids(filterInvoices(invoices, statuses, { to: "2026-10-05" }))).toEqual([1, 2]);
        expect(ids(filterInvoices(invoices, statuses, { from: "2026-09-02", to: "2026-09-02" }))).toEqual([1]);
    });

    it("filtre sur le tarif", () => {
        expect(ids(filterInvoices(invoices, statuses, { formula: "Adhésion avec salle Emile Allais" }))).toEqual([2]);
    });

    it("combine tous les filtres", () => {
        expect(ids(filterInvoices(invoices, statuses, { activity: "Tennis", status: "problem", from: "2026-10-01", search: "martin" }))).toEqual([2]);
        expect(ids(filterInvoices(invoices, statuses, { activity: "Tennis", status: "todo" }))).toEqual([]);
    });
});
