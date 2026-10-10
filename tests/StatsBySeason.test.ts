import { describe, expect, it } from "vitest";
import { totalsBySeason } from "../src/Stats";

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
