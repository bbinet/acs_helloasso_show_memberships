// Page d'administration (admin/) : factures des adhérents de la saison en cours, aperçu et envoi par email.
import 'papercss'
import './style.css'
import { showDates } from "./Dates";
import { invoiceFileName, invoicePdf, loadPdfMake } from "./InvoicePdf";
import { InvoiceService, type InvoiceStatus } from "./InvoiceService";
import type { Invoice } from "./InvoiceData.js";
import type { Issuer } from "./InvoiceDocument";
import { escape, euros, frenchDate } from "./format";
import adminData from "../acs-admin.json"

const { season, invoices, issuer, signature, service: serviceConfig } = adminData as {
    season: string;
    invoices: Invoice[];
    issuer: Issuer;
    signature: string | null;
    service: { url: string; token: string } | null;
};
const settings = { issuer, signature };
const service = serviceConfig ? new InvoiceService(serviceConfig.url, serviceConfig.token, season) : null;
let statuses: Record<string, InvoiceStatus> = {};
let sending = false;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// « À envoyer » : jamais envoyée. Les factures en erreur demandent d'abord une correction (adresse sur HelloAsso).
const isTodo = (invoice: Invoice) => !statuses[invoice.id];
const isProblem = (invoice: Invoice) => ["erreur", "non distribuée"].includes(statuses[invoice.id]?.status);

const statusCell = (invoice: Invoice) => {
    const status = statuses[invoice.id];
    if (!status)
        return service ? `<span class="badge secondary">à envoyer</span>` : "";
    const badge = status.status === "envoyée" ? "success" : "danger";
    const detail = status.detail ? `<br/><small>${escape(status.detail)}</small>` : "";
    return `<span class="badge ${badge}">${escape(status.status)}</span> <small>le ${frenchDate(status.date)}</small>${detail}`;
};

const visibleInvoices = () => {
    const search = element<HTMLInputElement>("search").value.trim().toLowerCase();
    const filter = element<HTMLSelectElement>("filter").value;
    return invoices.filter((invoice) => {
        const text = `${invoice.id} ${invoice.firstName} ${invoice.lastName} ${invoice.company} ${invoice.email}`.toLowerCase();
        if (search && !text.includes(search))
            return false;
        if (filter === "todo")
            return isTodo(invoice);
        if (filter === "problem")
            return isProblem(invoice);
        if (filter)
            return statuses[invoice.id]?.status === filter;
        return true;
    });
};

const render = () => {
    const rows = visibleInvoices().map((invoice) => `
        <tr>
          <td>${invoice.id}</td>
          <td>${frenchDate(invoice.date)}</td>
          <td>${escape(invoice.firstName)} ${escape(invoice.lastName)}<br/><small>${escape(invoice.company)}</small></td>
          <td>${escape(invoice.email)}</td>
          <td>${euros(invoice.total)}</td>
          <td>${statusCell(invoice)}</td>
          <td>
            <button class="btn-small" data-action="preview" data-id="${invoice.id}">Aperçu</button>
            <button class="btn-small" data-action="download" data-id="${invoice.id}">Télécharger</button>
            ${service ? `<button class="btn-small btn-secondary" data-action="send" data-id="${invoice.id}" ${sending ? "disabled" : ""}>${statuses[invoice.id] ? "Renvoyer" : "Envoyer"}</button>` : ""}
          </td>
        </tr>`);
    element("invoices").innerHTML = `
        <table class="table-hover">
          <thead><tr><th>N°</th><th>Payée le</th><th>Adhérent</th><th>Email</th><th>Montant</th><th>Envoi</th><th></th></tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>`;
    element("count").textContent = String(rows.length);
    const todo = invoices.filter(isTodo).length;
    const sendAll = element<HTMLButtonElement>("sendAll");
    sendAll.textContent = `Envoyer les factures à envoyer (${todo})`;
    sendAll.disabled = !service || sending || todo === 0;
};

const findInvoice = (id: string | undefined) => invoices.find((invoice) => String(invoice.id) === id);

// Envoie une facture ; renvoie false si l'envoi groupé doit s'arrêter (quota atteint)
const send = async (invoice: Invoice, resend: boolean) => {
    const pdf = await (await invoicePdf(invoice, settings)).getBase64();
    const result = await service!.send(invoice.id, pdf, resend);
    if (result.status)
        statuses[invoice.id] = result.status;
    if (!result.ok && !result.status)
        alert(`Facture n°${invoice.id} : ${result.error}`);
    return !result.quota;
};

const withSending = async (task: () => Promise<void>) => {
    sending = true;
    render();
    try {
        await task();
    } catch (e) {
        console.error(e);
        alert(`Erreur : ${(e as Error).message}`);
    } finally {
        sending = false;
        render();
    }
};

element("invoices").addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest("button");
    const invoice = findInvoice(button?.dataset.id);
    if (!button || !invoice)
        return;
    const action = button.dataset.action;
    try {
        if (action === "preview") {
            // Fenêtre ouverte tout de suite, pendant le clic : sinon le navigateur la bloque
            const win = window.open("", "_blank");
            await (await invoicePdf(invoice, settings)).open(win);
        }
        else if (action === "download")
            await (await invoicePdf(invoice, settings)).download(invoiceFileName(invoice));
    } catch (e) {
        console.error(e);
        alert((e as Error).message);
    }
    if (action === "send") {
        const resend = Boolean(statuses[invoice.id]);
        const question = resend
            ? `La facture n°${invoice.id} a déjà été envoyée (${statuses[invoice.id].status}). La renvoyer à ${invoice.email} ?`
            : `Envoyer la facture n°${invoice.id} à ${invoice.email} ?`;
        if (confirm(question))
            await withSending(async () => { await send(invoice, resend); });
    }
});

element("sendAll").addEventListener("click", async () => {
    const todo = invoices.filter(isTodo);
    if (!confirm(`Envoyer ${todo.length} facture(s) par email ?`))
        return;
    const progress = element("progress");
    await withSending(async () => {
        for (const [index, invoice] of todo.entries()) {
            progress.textContent = `Envoi ${index + 1}/${todo.length} : facture n°${invoice.id}...`;
            if (!(await send(invoice, false))) {
                progress.textContent = `Quota d'envoi quotidien de Gmail atteint après ${index} facture(s) : reprendre l'envoi demain.`;
                return;
            }
            render();
        }
        progress.textContent = `${todo.length} facture(s) traitée(s).`;
    });
});

element("search").addEventListener("input", render);
element("filter").addEventListener("change", render);

const initialise = async () => {
    element("season").textContent = season;
    showDates(true);
    render();
    // Chargé en avance, pour que le premier aperçu soit rapide ; une erreur sera signalée à l'usage
    loadPdfMake().catch(console.error);
    const banner = element("service");
    if (!service) {
        banner.className = "alert alert-warning";
        banner.textContent = "Service d'envoi non configuré : aperçu et téléchargement des factures seulement.";
        return;
    }
    try {
        statuses = await service.statuses();
        banner.className = "alert alert-success";
        banner.textContent = "Statuts d'envoi à jour.";
    } catch (e) {
        console.error(e);
        banner.className = "alert alert-danger";
        banner.textContent = `Statuts d'envoi indisponibles : ${(e as Error).message}`;
    }
    render();
};

initialise();
