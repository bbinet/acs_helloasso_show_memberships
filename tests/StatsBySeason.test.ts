import { describe, expect, it } from "vitest";
import { activitiesBySeason, totalsBySeason } from "../src/Stats";
import { NO_ACTIVITY } from "../src/InvoiceFilter";

const member = (date: string, activities: string[] = [], total = 20) => ({ date, activities, formula: "Adhésion", total });

// Saisons de la plus récente (en cours) à la plus ancienne, comme dans config.json
const seasons = [
    { season: "2026-2027", members: [member("2026-09-01", ["Tennis"], 30), member("2026-10-01", ["Tennis", "Yoga"], 45.5)] },
    { season: "2025-2026", members: [member("2025-09-02", ["Tennis"]), member("2025-09-20", ["Yoga"]), member("2025-12-01", ["Yoga"]), member("2026-01-10")] },
    { season: "2024-2025", members: [member("2024-09-10", ["Tennis"]), member("2024-09-11", ["Football"])] },
];

describe("totalsBySeason", () => {
    it("donne le nombre d'adhérents et le montant encaissé de chaque saison, de la plus ancienne à la plus récente", () => {
        expect(totalsBySeason(seasons)).toEqual([
            { season: "2024-2025", members: 2, revenue: 40 },
            { season: "2025-2026", members: 4, revenue: 80 },
            { season: "2026-2027", members: 2, revenue: 75.5 },
        ]);
    });
});

describe("activitiesBySeason", () => {
    // Aujourd'hui : 10 octobre de la saison en cours
    const table = activitiesBySeason(seasons, "2026-10-10");

    it("compte les adhérents de chaque activité, saison par saison, de la plus ancienne à la plus récente", () => {
        expect(table.seasons).toEqual(["2024-2025", "2025-2026", "2026-2027"]);
        expect(table.rows.map((row) => [row.name, row.counts])).toEqual([
            ["Tennis", [1, 1, 2]],
            ["Yoga", [0, 2, 1]],
            ["Football", [1, 0, 0]],
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
