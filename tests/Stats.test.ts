import { describe, expect, it } from "vitest";
import { activityCounts, byActivity, byFormula, cumulative, keyFigures, seasonCurve } from "../src/Stats";
import { NO_ACTIVITY } from "../src/InvoiceFilter";
import { invoice } from "./fixtures";

const sent = { status: "envoyée" as const, date: "2026-10-01T10:00:00Z", name: "", email: "", detail: "" };

const invoices = [
    invoice(1, { activities: ["Football", "Tennis"], total: 50, lines: [{ label: "Adhésion", amount: 20 }, { label: "Football", amount: 15 }, { label: "Tennis", amount: 15 }] }),
    invoice(2, { activities: ["Tennis"], total: 30.5, lines: [{ label: "Adhésion", amount: 20 }, { label: "Tennis", amount: 10.5 }] }),
    invoice(3, { activities: [], total: 20 }),
];
const statuses = { "1": sent, "2": { ...sent, status: "non distribuée" as const } };

describe("keyFigures", () => {
    it("compte les adhérents, le montant encaissé et les factures par statut", () => {
        expect(keyFigures(invoices, statuses)).toEqual({ members: 3, revenue: 100.5, sent: 1, todo: 1, problems: 1 });
    });
});

describe("byActivity", () => {
    it("regroupe les adhérents par activité, de la plus suivie à la moins suivie, avec les recettes de l'activité", () => {
        const groups = byActivity(invoices);
        expect(groups.map((g) => [g.name, g.count, g.revenue])).toEqual([
            ["Tennis", 2, 25.5],
            ["Football", 1, 15],
            [NO_ACTIVITY, 1, 0],
        ]);
        expect(groups[0].members.map((m) => m.id)).toEqual([1, 2]);
    });
});

describe("byFormula", () => {
    it("compte les adhérents de chaque tarif, avec ses recettes", () => {
        const list = [
            invoice(1, { formula: "Adhésion", lines: [{ label: "Adhésion", amount: 20 }] }),
            invoice(2, { formula: "Adhésion + salle", lines: [{ label: "Adhésion + salle", amount: 60 }] }),
            invoice(3, { formula: "Adhésion", lines: [{ label: "Adhésion", amount: 20 }, { label: "Tennis", amount: 10 }] }),
        ];
        expect(byFormula(list)).toEqual([
            { name: "Adhésion", count: 2, revenue: 40 },
            { name: "Adhésion + salle", count: 1, revenue: 60 },
        ]);
    });
});

describe("activityCounts", () => {
    it("compte les adhérents sans activité, avec 1, 2, ou 3 activités et plus", () => {
        const list = [[], ["A"], ["A", "B"], ["A", "B", "C"], ["A", "B", "C", "D"], ["B"]].map((activities, i) => invoice(i, { activities }));
        expect(activityCounts(list)).toEqual([1, 2, 1, 2]);
    });
});

describe("cumulative", () => {
    it("cumule les inscriptions jour après jour", () => {
        expect(cumulative(["2026-09-02", "2026-09-01", "2026-09-02", "2026-09-10"])).toEqual([
            { date: "2026-09-01", count: 1 },
            { date: "2026-09-02", count: 3 },
            { date: "2026-09-10", count: 4 },
        ]);
    });
});

describe("seasonCurve", () => {
    it("place les inscriptions de chaque saison au même jour de saison, compté depuis le 1er juillet, pour les comparer", () => {
        expect(seasonCurve("2026-2027", ["2026-07-01", "2026-09-15", "2026-09-15"])).toEqual([
            { day: 0, count: 1 },
            { day: 76, count: 3 },
        ]);
        expect(seasonCurve("2025-2026", ["2025-09-15"])).toEqual([{ day: 76, count: 1 }]);
        expect(seasonCurve("2025/2026", ["2026-01-01"])).toEqual([{ day: 184, count: 1 }]);
    });
});
