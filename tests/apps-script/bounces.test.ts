import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeEnvironment } from "./fakeGoogle";

const item = {
    id: 12345,
    user: { firstName: "Jean", lastName: "Dupont" },
    payer: { email: "jean.dupont@exemple.fr" },
    order: { date: "2024-09-15T10:30:00+02:00", formType: "Membership" },
    payments: [{ refundOperations: [] }],
};
const pdf = Buffer.from("%PDF-1.3").toString("base64");

// Facture envoyée à 10h, mail d'erreur reçu à 10h05, vérification à 11h
const sentAt = new Date("2026-10-09T10:00:00Z");
const bouncedAt = new Date("2026-10-09T10:05:00Z");
const checkedAt = new Date("2026-10-09T11:00:00Z");

const sentMessage = {
    date: sentAt,
    from: "ACS Savoie Technolac <acs.tresorier@gmail.com>",
    subject: "Facture adhésion ACS n°12345",
    body: "Veuillez trouver ci-joint la facture de votre adhésion à l'ACS.",
};

const gmailBounce = {
    date: bouncedAt,
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    subject: "Delivery Status Notification (Failure)",
    body: `
** Address not found **

Your message wasn't delivered to jean.dupont@exemple.fr because the address couldn't be found, or is unable to receive mail.

Learn more here: https://support.google.com/mail/?p=NoSuchUser

The response was:

550 5.1.1 The email account that you tried to reach does not exist.
`,
};

// Mail d'erreur en français, seul dans sa conversation : le n° de facture est dans le message d'origine cité
const frenchBounce = {
    date: bouncedAt,
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    subject: "Delivery Status Notification (Failure)",
    body: `
** Adresse introuvable **

Votre message n'a pas pu être envoyé à jean.dupont@exemple.fr, car l'adresse est introuvable ou ne peut pas recevoir de messages.

----- Message d'origine -----
From: ACS Savoie Technolac <acs.tresorier@gmail.com>
To: jean.dupont@exemple.fr
Subject: Facture adhésion ACS n°12345
`,
};

const delayNotification = {
    date: bouncedAt,
    from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    subject: "Delivery Status Notification (Delay)",
    body: "** Message not delivered yet **\n\nYour message to jean.dupont@exemple.fr hasn't been delivered yet. Gmail will keep trying.",
};

const outOfOffice = {
    date: bouncedAt,
    from: "Jean Dupont <jean.dupont@exemple.fr>",
    subject: "Réponse automatique : Facture adhésion ACS n°12345",
    body: "Je suis absent jusqu'au 20 octobre.",
};

const sentInvoice = () => {
    vi.setSystemTime(sentAt);
    const environment = fakeEnvironment({ 12345: item });
    environment.post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf });
    vi.setSystemTime(checkedAt);
    return environment;
};
const status = (post: (body: object) => any) => post({ token: "jeton-secret", season: "2026-2027", action: "status" }).invoices["12345"];

describe("mails d'erreur reçus après l'envoi", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("passe la facture en « non distribuée », avec la raison donnée par le serveur", () => {
        const { env, script, post } = sentInvoice();
        env.inbox.push({ messages: [sentMessage, gmailBounce] });
        script.checkBounces();
        expect(status(post)).toMatchObject({
            status: "non distribuée",
            detail: "Your message wasn't delivered to jean.dupont@exemple.fr because the address couldn't be found, or is unable to receive mail.",
        });
    });

    it("retrouve la facture dans le message d'origine cité par un mail d'erreur en français", () => {
        const { env, script, post } = sentInvoice();
        env.inbox.push({ messages: [frenchBounce] });
        script.checkBounces();
        expect(status(post)).toMatchObject({
            status: "non distribuée",
            detail: "Votre message n'a pas pu être envoyé à jean.dupont@exemple.fr, car l'adresse est introuvable ou ne peut pas recevoir de messages.",
        });
    });

    it.each([
        ["un envoi seulement retardé", delayNotification],
        ["une réponse d'absence", outOfOffice],
    ])("ignore %s", (_, message) => {
        const { env, script, post } = sentInvoice();
        env.inbox.push({ messages: [sentMessage, message] });
        script.checkBounces();
        expect(status(post).status).toBe("envoyée");
    });

    it("ne tient pas compte d'un mail d'erreur antérieur au dernier envoi de la facture", () => {
        const { env, script, post } = sentInvoice();
        env.inbox.push({ messages: [sentMessage, gmailBounce] });
        script.checkBounces();
        vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf, resend: true });
        script.checkBounces();
        expect(status(post).status).toBe("envoyée");
    });

    it("détecte le mail d'erreur d'un renvoi, rangé dans la même conversation que le premier", () => {
        const { env, script, post } = sentInvoice();
        const thread = { messages: [sentMessage, gmailBounce] };
        env.inbox.push(thread);
        script.checkBounces();
        vi.setSystemTime(new Date("2026-10-09T12:00:00Z"));
        post({ token: "jeton-secret", season: "2026-2027", action: "send", id: 12345, pdf, resend: true });
        thread.messages.push({ ...gmailBounce, date: new Date("2026-10-09T12:05:00Z") });
        vi.setSystemTime(new Date("2026-10-09T13:00:00Z"));
        script.checkBounces();
        expect(status(post).status).toBe("non distribuée");
    });

    it("retrouve aussi les factures des saisons précédentes", () => {
        vi.setSystemTime(sentAt);
        const { env, script, post } = fakeEnvironment({ 12345: item });
        post({ token: "jeton-secret", season: "2025-2026", action: "send", id: 12345, pdf });
        vi.setSystemTime(checkedAt);
        env.inbox.push({ messages: [sentMessage, gmailBounce] });
        script.checkBounces();
        expect(post({ token: "jeton-secret", season: "2025-2026", action: "status" }).invoices["12345"].status).toBe("non distribuée");
        expect(Object.keys(env.sheets)).toEqual(["Factures 2025-2026"]);
    });
});
