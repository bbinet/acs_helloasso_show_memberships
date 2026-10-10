import { describe, expect, it } from "vitest";
import { emailList, toCsv } from "../src/Export";
import { invoice } from "./fixtures";

describe("toCsv", () => {
    const invoices = [
        invoice(1, { firstName: "Marie", lastName: "Durand", company: "SOPRA; STERIA", activities: ["Football", "Tennis"], total: 35.5, formula: "Adhésion \"classique\"" }),
        invoice(2, { firstName: "Paul", lastName: "Martin", activities: [] }),
    ];
    const statuses = { "1": { status: "envoyée" as const, date: "2026-10-01T10:00:00Z", name: "", email: "", detail: "" } };

    it("produit un CSV pour Excel : BOM UTF-8, séparateur ;, fins de ligne Windows, montants à virgule", () => {
        const csv = toCsv(invoices, statuses);
        expect(csv.startsWith("﻿")).toBe(true);
        const lines = csv.slice(1).split("\r\n");
        expect(lines[0]).toBe("N°;Payée le;Prénom;Nom;Entreprise;Email;Tarif;Activités;Montant;Envoi;Envoyée le");
        expect(lines[1]).toBe('1;15/09/2026;Marie;Durand;"SOPRA; STERIA";adherent1@example.com;"Adhésion ""classique""";Football, Tennis;35,50;envoyée;01/10/2026');
        expect(lines[2]).toBe("2;15/09/2026;Paul;Martin;ACME;adherent2@example.com;Adhésion à l'ACS;;20,00;;");
        expect(lines).toHaveLength(3);
    });
});

describe("emailList", () => {
    it("liste les adresses au format « \"Prénom Nom\" <email> », sans doublon", () => {
        const list = emailList([
            invoice(1, { firstName: "Marie", lastName: "Durand", email: "marie@example.com" }),
            invoice(2, { firstName: "Paul", lastName: "Martin", email: "paul@example.com" }),
            invoice(3, { firstName: "Marie", lastName: "Durand", email: "marie@example.com" }),
        ]);
        expect(list).toBe('"Marie Durand" <marie@example.com>, "Paul Martin" <paul@example.com>');
    });

    it("retire les guillemets des noms, qui casseraient l'adresse", () => {
        expect(emailList([invoice(1, { firstName: "Jean \"Jeannot\"", lastName: "Dupont", email: "j@example.com" })]))
            .toBe('"Jean Jeannot Dupont" <j@example.com>');
    });
});
