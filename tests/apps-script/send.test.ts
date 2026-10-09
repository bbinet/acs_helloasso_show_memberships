import { describe, expect, it } from "vitest";
import { fakeEnvironment } from "./fakeGoogle";

// Adhésion telle que renvoyée par l'API HelloAsso (/v5/items/{id}?withDetails=true)
const item = (id: number, overrides: object = {}) => ({
    id,
    name: "Adhésion à l'ACS",
    amount: 2000,
    user: { firstName: "Jean", lastName: "Dupont" },
    payer: { email: "jean.dupont@example.com", firstName: "Jean", lastName: "Dupont" },
    order: { id: 999, date: "2024-09-15T10:30:00+02:00", formName: "Adhésion ACS 2024-2025", formType: "Membership" },
    payments: [{ amount: 2000, refundOperations: [] }],
    ...overrides,
});

const pdf = Buffer.from("%PDF-1.3 facture").toString("base64");

describe("application web : envoi des factures", () => {
    it("refuse une demande sans le bon jeton, sans rien envoyer", () => {
        const { env, post } = fakeEnvironment({ 12345: item(12345) });
        const result = post({ token: "mauvais", action: "send", id: 12345, pdf });
        expect(result).toEqual({ ok: false, error: "Accès refusé" });
        expect(env.sent).toEqual([]);
    });

    it("envoie la facture en pièce jointe au payeur connu de HelloAsso, pas à l'adresse donnée par la page", () => {
        const { env, post } = fakeEnvironment({ 12345: item(12345) });
        const result = post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf, to: "pirate@example.com" });
        expect(result).toMatchObject({ ok: true, status: { status: "envoyée", email: "jean.dupont@example.com" } });
        expect(env.sent).toHaveLength(1);
        expect(env.sent[0].to).toBe("jean.dupont@example.com");
        expect(env.sent[0].subject).toContain("n°12345");
        expect(env.sent[0].options.attachments[0].name).toBe("Facture-ACS-12345.pdf");
        expect(env.sent[0].options.attachments[0].contentType).toBe("application/pdf");
    });

    it("liste les factures envoyées, avec la date d'envoi", () => {
        const { post } = fakeEnvironment({ 12345: item(12345) });
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf });
        const result = post({ token: "jeton-secret", season: "2026-2027", action: "status" });
        expect(result.ok).toBe(true);
        expect(result.invoices["12345"]).toMatchObject({ status: "envoyée", email: "jean.dupont@example.com" });
        expect(new Date(result.invoices["12345"].date).getTime()).toBeGreaterThan(Date.now() - 60000);
    });

    it("refuse d'envoyer deux fois la même facture, sauf renvoi demandé", () => {
        const { env, post } = fakeEnvironment({ 12345: item(12345) });
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf });
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf })).toMatchObject({ ok: false, error: "Facture n°12345 déjà envoyée" });
        expect(env.sent).toHaveLength(1);
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf, resend: true })).toMatchObject({ ok: true });
        expect(env.sent).toHaveLength(2);
        expect(Object.keys(post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices)).toEqual(["12345"]);
    });

    it.each([
        ["remboursée", 1, { payments: [{ amount: 2000, refundOperations: [{ id: 1 }] }] }, "Adhésion n°1 remboursée"],
        ["d'un autre formulaire", 2, { order: { ...item(2).order, formType: "Event" } }, "N°2 : pas une adhésion"],
        ["inconnue de HelloAsso", 3, null, "Adhésion n°3 introuvable sur HelloAsso"],
    ])("refuse une adhésion %s, sans rien envoyer", (_, id, overrides, error) => {
        const { env, post } = fakeEnvironment(overrides ? { [id]: item(id, overrides) } : {});
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "send", id, pdf })).toEqual({ ok: false, error });
        expect(env.sent).toEqual([]);
    });

    it("enregistre l'erreur quand Gmail refuse l'envoi", () => {
        const { env, post } = fakeEnvironment({ 12345: item(12345) });
        env.gmailError = "Invalid email: jean.dupont@example";
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf })).toMatchObject({
            ok: false, error: "Invalid email: jean.dupont@example", status: { status: "erreur", detail: "Invalid email: jean.dupont@example" },
        });
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices["12345"].status).toBe("erreur");
    });

    it("signale le quota d'envoi quotidien épuisé, sans rien envoyer ni enregistrer", () => {
        const { env, post } = fakeEnvironment({ 12345: item(12345) });
        env.quota = 0;
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf })).toMatchObject({ ok: false, quota: true });
        expect(env.sent).toEqual([]);
        expect(post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices).toEqual({});
    });

    it("archive le PDF envoyé dans le sous-dossier de la saison, créé au besoin", () => {
        const { env, post } = fakeEnvironment({ 1: item(1), 2: item(2), 3: item(3) });
        env.properties.DRIVE_FOLDER_ID = "dossier-factures";
        post({ token: "jeton-secret", season: "2025-2026", action: "send", id: 1, pdf });
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 2, pdf });
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 3, pdf });
        expect(env.drive).toEqual({
            "dossier-factures": [],
            "dossier-factures/2025-2026": ["Facture-ACS-1.pdf"],
            "dossier-factures/2026-2027": ["Facture-ACS-2.pdf", "Facture-ACS-3.pdf"],
        });
    });

    it("tient un registre séparé par saison, dans l'onglet « Factures <saison> »", () => {
        const { env, post } = fakeEnvironment({ 1: item(1), 2: item(2) });
        post({ token: "jeton-secret", season: "2025-2026", action: "send", id: 1, pdf });
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 2, pdf });
        expect(Object.keys(post({ token: "jeton-secret", season: "2025-2026", action: "status" }).invoices)).toEqual(["1"]);
        expect(Object.keys(post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices)).toEqual(["2"]);
        expect(Object.keys(env.sheets)).toEqual(["Factures 2025-2026", "Factures 2026-2027"]);
    });

    it("refuse une demande sans saison valide", () => {
        const { env, post } = fakeEnvironment({ 12345: item(12345) });
        expect(post({ token: "jeton-secret", action: "send", id: 12345, pdf })).toEqual({ ok: false, error: "Saison invalide" });
        expect(post({ token: "jeton-secret", season: "../2026", action: "status" })).toEqual({ ok: false, error: "Saison invalide" });
        expect(env.sent).toEqual([]);
    });

    it("accepte aussi la saison écrite 2026/2027, rangée dans le même onglet que 2026-2027", () => {
        const { env, post } = fakeEnvironment({ 1: item(1) });
        expect(post({ token: "jeton-secret", season: "2026/2027", action: "send", id: 1, pdf })).toMatchObject({ ok: true });
        expect(Object.keys(post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices)).toEqual(["1"]);
        expect(Object.keys(env.sheets)).toEqual(["Factures 2026-2027"]);
    });

    it("utilise la feuille désignée par SHEET_ID quand le script n'est pas rattaché à une feuille", () => {
        const { env, post } = fakeEnvironment({ 1: item(1) });
        env.properties.SHEET_ID = "id-de-la-feuille";
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 1, pdf });
        expect(env.openedById).toBe(true);
        expect(Object.keys(post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices)).toEqual(["1"]);
    });
});
