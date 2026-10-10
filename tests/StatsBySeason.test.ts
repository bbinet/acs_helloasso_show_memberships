import { describe, expect, it } from "vitest";
import { activitiesBySeason, byActivity, byFormula, bySeasonMonth, keyFigures, totalsBySeason } from "../src/Stats";
import { NO_ACTIVITY } from "../src/InvoiceFilter";

const member = (date: string, activities: string[] = [], total = 20) => ({ date, activities, formula: "Adhésion", total });

// Saisons de la plus récente (en cours) à la plus ancienne, comme dans config.json
const seasons = [
    { season: "2026-2027", members: [member("2026-09-01", ["Tennis"], 30), member("2026-10-01", ["Tennis", "Yoga"], 45.5)] },
    { season: "2025-2026", members: [member("2025-09-02", ["Tennis"]), member("2025-09-20", ["Yoga"]), member("2025-12-01", ["Yoga"]), member("2026-01-10")] },
    { season: "2024-2025", members: [member("2024-09-10", ["Tennis"]), member("2024-09-11", ["Football"])] },
];

describe("totalsBySeason", () => {
    // Aujourd'hui : 10 octobre de la saison en cours
    const totals = totalsBySeason(seasons, "2026-10-10");

    it("donne le nombre d'adhérents et le montant encaissé de chaque saison, de la saison en cours à la plus ancienne", () => {
        expect(totals.map(({ season, members, revenue }) => ({ season, members, revenue }))).toEqual([
            { season: "2026-2027", members: 2, revenue: 75.5 },
            { season: "2025-2026", members: 4, revenue: 80 },
            { season: "2024-2025", members: 2, revenue: 40 },
        ]);
    });

    it("donne aussi les adhérents et le montant encaissé de chaque saison au même jour de saison qu'aujourd'hui", () => {
        // Au 10 octobre 2025 : les inscrits du 2 et du 20 septembre
        expect(totals.map(({ season, membersAtSameDay, revenueAtSameDay }) => [season, membersAtSameDay, revenueAtSameDay])).toEqual([
            ["2026-2027", 2, 75.5],
            ["2025-2026", 2, 40],
            ["2024-2025", 2, 40],
        ]);
    });
});

describe("bySeasonMonth", () => {
    it("compte les inscriptions de chaque mois de la saison, de septembre à août", () => {
        const counts = bySeasonMonth("2025-2026", seasons[1].members);
        expect(counts).toHaveLength(12);
        // septembre : 2, décembre : 1, janvier : 1
        expect(counts).toEqual([2, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("compte une inscription faite avant septembre en septembre, et après août en août", () => {
        expect(bySeasonMonth("2025-2026", [member("2025-07-15"), member("2026-08-31"), member("2026-09-02")]))
            .toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
    });
});

describe("activitiesBySeason", () => {
    // Aujourd'hui : 10 octobre de la saison en cours
    const table = activitiesBySeason(seasons, "2026-10-10");

    it("compte les adhérents de chaque activité, saison par saison, de la saison en cours à la plus ancienne", () => {
        expect(table.seasons).toEqual(["2026-2027", "2025-2026", "2024-2025"]);
        expect(table.rows.map((row) => [row.name, row.counts])).toEqual([
            ["Tennis", [2, 1, 1]],
            ["Yoga", [1, 2, 0]],
            ["Football", [0, 0, 1]],
            [NO_ACTIVITY, [0, 1, 0]],
        ]);
    });

    it("compare la saison en cours à la saison précédente au même jour de saison", () => {
        // Au 10 octobre 2025 : 1 adhérent au tennis, 1 au yoga (celui du 1er décembre n'était pas encore inscrit)
        expect(table.previousSeason).toBe("2025-2026");
        expect(table.rows.map((row) => [row.name, row.previousAtSameDay, row.change])).toEqual([
            ["Tennis", 1, 1],
            ["Yoga", 1, 0],
            ["Football", 0, 0],
            [NO_ACTIVITY, 0, 0],
        ]);
    });

    it("ne compare rien s'il n'y a pas de saison précédente", () => {
        const single = activitiesBySeason([seasons[0]], "2026-10-10");
        expect(single.previousSeason).toBeNull();
        expect(single.rows[0]).toMatchObject({ name: "Tennis", previousAtSameDay: null, change: null });
    });
});

describe("bilan d'une saison archivée", () => {
    // Résumés sans nom ni n° d'adhésion (voir summarize)
    const archived = [
        { date: "2025-09-02", activities: ["Tennis"], formula: "Adhésion", total: 30, lines: [{ label: "Adhésion", amount: 20 }, { label: "Tennis", amount: 10 }] },
        { date: "2025-09-20", activities: [], formula: "Adhésion + salle", total: 60, lines: [{ label: "Adhésion + salle", amount: 60 }] },
    ];

    it("donne les chiffres clés, les tarifs et les activités à partir des résumés", () => {
        expect(keyFigures(archived)).toEqual({ members: 2, revenue: 90 });
        expect(byFormula(archived)).toEqual([{ name: "Adhésion", count: 1, revenue: 20 }, { name: "Adhésion + salle", count: 1, revenue: 60 }]);
        expect(byActivity(archived).map((group) => [group.name, group.count, group.revenue])).toEqual([["Tennis", 1, 10], [NO_ACTIVITY, 1, 0]]);
    });
});
