// Dialogue avec le script Google Apps Script qui envoie les factures et tient le registre des envois
// (voir apps-script/Code.js), pour une saison. Corps JSON envoyé en text/plain : pas de requête préalable CORS.
export interface InvoiceStatus {
    status: "envoyée" | "erreur" | "non distribuée";
    date: string;
    name: string;
    email: string;
    detail: string;
}

// Pour les filtres, les statistiques et l'affichage : à envoyer (jamais envoyée), envoyée,
// ou en erreur (refusée par Gmail ou non distribuée : l'adresse est à corriger sur HelloAsso)
export type StatusCategory = "todo" | "sent" | "problem";
export const statusCategory = (status?: InvoiceStatus): StatusCategory =>
    !status ? "todo" : status.status === "envoyée" ? "sent" : "problem";

export interface SendResult { ok: boolean; error?: string; quota?: boolean; status?: InvoiceStatus }

export class InvoiceService {
    constructor(private url: string, private token: string, private season: string) {}

    private async call(request: object) {
        const response = await fetch(this.url, { method: "POST", body: JSON.stringify({ token: this.token, season: this.season, ...request }) });
        if (!response.ok)
            throw new Error(`Service d'envoi : erreur ${response.status}`);
        return response.json();
    }

    async statuses(): Promise<Record<string, InvoiceStatus>> {
        const result = await this.call({ action: "status" });
        if (!result.ok)
            throw new Error(result.error);
        return result.invoices;
    }

    send(id: number, pdf: string, resend = false): Promise<SendResult> {
        return this.call({ action: "send", id, pdf, resend });
    }
}
