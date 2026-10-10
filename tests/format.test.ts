import { describe, expect, it } from "vitest";
import { euros, frenchDate } from "../src/format";

describe("format", () => {
    it("écrit les montants à la française, sans coupure possible avant le « € » ni dans les milliers", () => {
        expect(euros(15.5)).toBe("15,50 €");
        expect(euros(13202)).toBe("13 202,00 €");
        expect(euros(1234567.891)).toBe("1 234 567,89 €");
    });

    it("écrit les dates en jj/mm/aaaa, en heure de Paris", () => {
        expect(frenchDate("2026-09-15")).toBe("15/09/2026");
        expect(frenchDate("2026-10-01T23:30:00Z")).toBe("02/10/2026");
    });
});
