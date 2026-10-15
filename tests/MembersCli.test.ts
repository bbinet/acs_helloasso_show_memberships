import { describe, expect, it } from "vitest";
import { completionScript, formatPattern, formatSummary, formatText, selectMembers } from "../src/MembersCli";
import { invoice } from "./fixtures";

const members = [
    invoice(1, { firstName: "Marie", lastName: "Bérard", company: "SOPRA", activities: ["Football", "Yoga"], formula: "Adhésion ACS (+ accès gymnases)", date: "2026-09-02", total: 75 }),
    invoice(2, { firstName: "Jean", lastName: "Dupont", activities: ["Tennis"], date: "2026-09-20", phone: "06 12 34 56 78" }),
    invoice(3, { firstName: "Léa", lastName: "Martin", activities: [], date: "2026-10-05" }),
];

describe("selectMembers", () => {
    it("filtre les activités et les tarifs par expression régulière, sans tenir compte des majuscules", () => {
        expect(selectMembers(members, { activity: "foot|tennis" }).map((m) => m.id)).toEqual([1, 2]);
        expect(selectMembers(members, { formula: "gymnases" }).map((m) => m.id)).toEqual([1]);
    });

    it("cherche dans les noms, l'entreprise, l'email et le n°, et filtre la période d'inscription, comme la page admin", () => {
        expect(selectMembers(members, { search: "berard" }).map((m) => m.id)).toEqual([1]);
        expect(selectMembers(members, { from: "2026-09-10", to: "2026-09-30" }).map((m) => m.id)).toEqual([2]);
        expect(selectMembers(members, {}).map((m) => m.id)).toEqual([1, 2, 3]);
    });
});

describe("formatPattern", () => {
    it("remplace les champs de l'adhésion dans le modèle", () => {
        expect(formatPattern(members[0], '"{firstName} {lastName}" <{email}>')).toBe('"Marie Bérard" <adherent1@example.com>');
        expect(formatPattern(members[0], "{id} {date} {activities} {total}")).toBe("1 02/09/2026 Football, Yoga 75,00 €");
    });

    it("refuse un champ inconnu, en donnant la liste des champs possibles", () => {
        expect(() => formatPattern(members[0], "{prenom}")).toThrow(/prenom.*firstName/);
    });
});

describe("formatText", () => {
    it("présente chaque adhésion sur quelques lignes : n°, date, tarif, nom, entreprise, email, téléphone, activités", () => {
        const text = formatText([members[1]]);
        expect(text).toContain("1. N°2 le 20/09/2026");
        expect(text).toContain("Jean Dupont (ACME)");
        expect(text).toContain("adherent2@example.com - 06 12 34 56 78");
        expect(text).toContain("Tennis");
    });
});

describe("formatSummary", () => {
    it("compte les adhérents de chaque activité, sans activité en dernier", () => {
        expect(formatSummary(members, false)).toBe(["Football : 1", "Tennis : 1", "Yoga : 1", "[Aucune activité] : 1"].join("\n"));
    });

    it("liste aussi les adhérents de chaque activité", () => {
        expect(formatSummary(members.slice(0, 2), true)).toBe([
            "Football : 1", "    Marie Bérard (SOPRA)", "",
            "Tennis : 1", "    Jean Dupont (ACME)", "",
            "Yoga : 1", "    Marie Bérard (SOPRA)",
        ].join("\n"));
    });
});

describe("completionScript", () => {
    const seasons = ["2026-2027", "2025-2026"];

    it("complète les options, les formats et les saisons pour cli.sh", () => {
        const script = completionScript("bash", seasons);
        expect(script).toContain("--activity");
        expect(script).toContain("summary-members");
        expect(script).toContain("2026-2027 2025-2026");
        expect(script).toMatch(/complete -F \w+ cli\.sh \.\/cli\.sh/);
        expect(script).not.toContain("bashcompinit");
    });

    it("charge la compatibilité bash dans zsh", () => {
        expect(completionScript("zsh", seasons)).toContain("bashcompinit");
    });

    it("refuse un shell inconnu", () => {
        expect(() => completionScript("fish", seasons)).toThrow(/bash, zsh/);
    });
});
