// Page d'administration (admin/) : adhérents de la saison en cours, leurs factures (aperçu, envoi par email),
// exports et statistiques.
import 'papercss'
import './style.css'
import { showDates } from "./Dates";
import { invoiceFileName, invoicePdf, loadPdfMake } from "./InvoicePdf";
import { InvoiceService, statusCategory, type InvoiceStatus } from "./InvoiceService";
import type { Invoice } from "./InvoiceData.js";
import type { Issuer } from "./InvoiceDocument";
import { filterInvoices, NO_ACTIVITY, type FilterCriteria } from "./InvoiceFilter";
import { emailList, toCsv, uniqueByEmail } from "./Export";
import { renderStats, type SeasonHistory } from "./AdminStats";
import { showMembersTable } from "./MembersTable";
import { escape, euros, frenchDate, parisTime } from "./format";
import adminData from "../acs-admin.json"
// Liste de la page des adhérents, reprise telle quelle par l'onglet « Adhérents »
import { fields as memberFields, datas as memberDatas } from "../acs.json"

const { season, invoices, issuer, signature, service: serviceConfig, history } = adminData as {
    season: string;
    invoices: Invoice[];
    issuer: Issuer;
    signature: string | null;
    service: { url: string; token: string } | null;
    history?: SeasonHistory[];
};
const settings = { issuer, signature };
const service = serviceConfig ? new InvoiceService(serviceConfig.url, serviceConfig.token, season) : null;
let statuses: Record<string, InvoiceStatus> = {};
let sending = false;
// Factures cochées (n°), conservées d'une page ou d'un filtre à l'autre
const selected = new Set<number>();
let page = 1;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// « À envoyer » : jamais envoyée. Les factures en erreur demandent d'abord une correction (adresse sur HelloAsso).
const isTodo = (invoice: Invoice) => statusCategory(statuses[invoice.id]) === "todo";

const statusCell = (invoice: Invoice) => {
    const status = statuses[invoice.id];
    if (!status)
        return service ? `<span class="badge secondary">à envoyer</span>` : "";
    const badge = statusCategory(status) === "sent" ? "success" : "danger";
    const detail = status.detail ? `<br/><small>${escape(status.detail)}</small>` : "";
    return `<span class="badge ${badge}">${escape(status.status)}</span> <small>le ${frenchDate(status.date)}</small>${detail}`;
};

const value = (id: string) => element<HTMLInputElement | HTMLSelectElement>(id).value;
const criteria = (): FilterCriteria => ({
    search: value("search"),
    status: value("filter") as FilterCriteria["status"],
    activity: value("activity"),
    formula: value("formula"),
    from: value("from"),
    to: value("to"),
});
const filteredInvoices = () => filterInvoices(invoices, statuses, criteria());

// Taille de page : 0 = tout afficher
const pageSize = () => Number(element<HTMLSelectElement>("pageSize").value);

const renderPages = (pageCount: number) => {
    element("pages").innerHTML = pageCount <= 1 ? "" : Array.from({ length: pageCount }, (_, i) =>
        `<button class="btn-small${i + 1 === page ? " btn-secondary" : ""}" data-page="${i + 1}">${i + 1}</button>`).join("");
};

const render = () => {
    const filtered = filteredInvoices();
    const size = pageSize() || filtered.length || 1;
    const pageCount = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(page, pageCount);
    const shown = filtered.slice((page - 1) * size, page * size);
    const rows = shown.map((invoice) => `
        <tr>
          <td class="select"><input type="checkbox" data-select="${invoice.id}" ${selected.has(invoice.id) ? "checked" : ""}/></td>
          <td>${invoice.id}</td>
          <td>${frenchDate(invoice.date)}</td>
          <td>${escape(invoice.firstName)} ${escape(invoice.lastName)}<br/><small>${escape(invoice.company)}</small></td>
          <td>${escape(invoice.email)}${invoice.phone ? `<br/><small>${escape(invoice.phone)}</small>` : ""}</td>
          <td class="activities">${invoice.activities.map(escape).join("<br/>")}</td>
          <td>${euros(invoice.total)}</td>
          <td>${statusCell(invoice)}</td>
          <td>
            <button class="btn-small" data-action="preview" data-id="${invoice.id}">Aperçu</button>
            <button class="btn-small" data-action="download" data-id="${invoice.id}">Télécharger</button>
            ${service ? `<button class="btn-small btn-secondary" data-action="send" data-id="${invoice.id}" ${sending ? "disabled" : ""}>${statuses[invoice.id] ? "Renvoyer" : "Envoyer"}</button>` : ""}
          </td>
        </tr>`);
    const pageSelected = shown.length > 0 && shown.every((invoice) => selected.has(invoice.id));
    element("invoices").innerHTML = `
        <table class="table-hover">
          <thead><tr>
            <th class="select"><input type="checkbox" data-select="page" title="Sélectionner les factures de la page" ${pageSelected ? "checked" : ""}/></th>
            <th>N°</th><th>Payée le</th><th>Adhérent</th><th>Email / téléphone</th><th>Activités</th><th>Montant</th><th>Envoi</th><th>Facture</th>
          </tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>`;
    const range = filtered.length > shown.length ? ` (${(page - 1) * size + 1} à ${(page - 1) * size + shown.length} affichées)` : "";
    element("count").textContent = `${filtered.length}${range}`;
    renderPages(pageCount);

    const todo = invoices.filter(isTodo).length;
    const sendAll = element<HTMLButtonElement>("sendAll");
    sendAll.textContent = `Envoyer les factures à envoyer (${todo})`;
    sendAll.disabled = !service || sending || todo === 0;
    const sendSelected = element<HTMLButtonElement>("sendSelected");
    sendSelected.textContent = `Envoyer la sélection (${selected.size})`;
    sendSelected.disabled = !service || sending || selected.size === 0;
    element<HTMLButtonElement>("selectAll").textContent = `Tout sélectionner (${filtered.length})`;
    element<HTMLButtonElement>("selectNone").disabled = selected.size === 0;
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

// Envoie une liste de factures, une par une ; s'arrête si le quota quotidien de Gmail est atteint
const sendBatch = async (batch: Invoice[]) => {
    const progress = element("progress");
    await withSending(async () => {
        for (const [index, invoice] of batch.entries()) {
            progress.textContent = `Envoi ${index + 1}/${batch.length} : facture n°${invoice.id}...`;
            if (!(await send(invoice, Boolean(statuses[invoice.id])))) {
                progress.textContent = `Quota d'envoi quotidien de Gmail atteint après ${index} facture(s) : reprendre l'envoi demain.`;
                return;
            }
            if (statusCategory(statuses[invoice.id]) === "sent")
                selected.delete(invoice.id);
            render();
        }
        progress.textContent = `${batch.length} facture(s) traitée(s).`;
    });
};

element("sendAll").addEventListener("click", async () => {
    const todo = invoices.filter(isTodo);
    if (confirm(`Envoyer ${todo.length} facture(s) par email ?`))
        await sendBatch(todo);
});

element("sendSelected").addEventListener("click", async () => {
    const batch = invoices.filter((invoice) => selected.has(invoice.id));
    const resent = batch.filter((invoice) => statuses[invoice.id]).length;
    const question = `Envoyer ${batch.length} facture(s) par email ?`
        + (resent ? `\n\n${resent} d'entre elles ont déjà été envoyées et seront renvoyées.` : "");
    if (confirm(question))
        await sendBatch(batch);
});

element("selectAll").addEventListener("click", () => {
    filteredInvoices().forEach((invoice) => selected.add(invoice.id));
    render();
});

element("selectNone").addEventListener("click", () => {
    selected.clear();
    render();
});

// Cases à cocher : une facture, ou toutes celles de la page
element("invoices").addEventListener("change", (event) => {
    const box = event.target as HTMLInputElement;
    if (!box.dataset.select)
        return;
    const ids = box.dataset.select === "page"
        ? Array.from(element("invoices").querySelectorAll<HTMLInputElement>("tbody input[data-select]")).map((b) => Number(b.dataset.select))
        : [Number(box.dataset.select)];
    ids.forEach((id) => (box.checked ? selected.add(id) : selected.delete(id)));
    render();
});

element("pages").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-page]");
    if (!button)
        return;
    page = Number(button.dataset.page);
    render();
    element("count").scrollIntoView({ behavior: "smooth" });
});

// Nouvelle recherche, nouveau filtre ou nouvelle taille de page : retour à la première page
for (const [id, type] of [["search", "input"], ["filter", "change"], ["activity", "change"], ["formula", "change"],
                          ["from", "change"], ["to", "change"], ["pageSize", "change"]])
    element(id).addEventListener(type, () => { page = 1; render(); });

// Exports de la liste filtrée (toutes les pages)
element("exportCsv").addEventListener("click", () => {
    const blob = new Blob([toCsv(filteredInvoices(), statuses)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `adherents-acs-${season}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
});

element("copyEmails").addEventListener("click", async () => {
    const list = filteredInvoices();
    const emails = emailList(list);
    const count = uniqueByEmail(list).length;
    try {
        await navigator.clipboard.writeText(emails);
        element("progress").textContent = `${count} adresse(s) copiée(s) : à coller dans le champ « Cci » d'un mail.`;
    } catch {
        // Presse-papiers refusé par le navigateur : adresses affichées pour un copier-coller à la main
        prompt("Copier les adresses :", emails);
    }
});

// Listes des activités et des tarifs pour les filtres, telles que dans HelloAsso
const fillSelect = (id: string, names: string[]) => element(id).insertAdjacentHTML("beforeend",
    names.map((name) => `<option value="${escape(name)}">${escape(name)}</option>`).join(""));
fillSelect("activity", [...[...new Set(invoices.flatMap((invoice) => invoice.activities))].sort((a, b) => a.localeCompare(b, "fr")), NO_ACTIVITY]);
fillSelect("formula", [...new Set(invoices.map((invoice) => invoice.formula))].sort((a, b) => a.localeCompare(b, "fr")));

// Onglets ; les statistiques sont calculées à l'ouverture de l'onglet, avec les derniers statuts d'envoi
const showTab = (tab: string) => {
    document.querySelectorAll<HTMLButtonElement>("nav.tabs button").forEach((button) =>
        button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
    element("tab-members").hidden = tab !== "members";
    element("tab-list").hidden = tab !== "list";
    element("tab-stats").hidden = tab !== "stats";
    if (tab === "stats")
        renderStats(element("stats"), season, invoices, statuses, history ?? []).catch((e) => {
            console.error(e);
            element("stats").insertAdjacentHTML("afterbegin", `<p class="alert alert-danger">Graphes indisponibles : ${escape((e as Error).message)}</p>`);
        });
};
document.querySelectorAll<HTMLButtonElement>("nav.tabs button").forEach((button) =>
    button.addEventListener("click", () => showTab(button.dataset.tab!)));

const initialise = async () => {
    element("season").textContent = season;
    // Onglet « Adhérents » : la même liste que la page des adhérents
    showMembersTable(memberFields, memberDatas,
        { datas: "m-datas", count: "m-count", filter: "m-filter", search: "m-search", pages: "m-pages", paginationOptions: "m-paginationOptions" },
        { activitiesField: 4, searchFields: [0, 1, 2] },
    ).catch((e) => {
        console.error(e);
        element("m-datas").innerHTML = `<div class="alert alert-warning">Problème technique : la liste ne peut pas être affichée.</div>`;
    });
    showDates(true);
    render();
    // Chargé en avance, pour que le premier aperçu soit rapide ; une erreur sera signalée à l'usage
    loadPdfMake().catch(console.error);
    // État du registre des envois (feuille Google lue par le script) : en haut à gauche
    const banner = element("service");
    if (!service) {
        banner.className = "warning";
        banner.textContent = "Envoi non configuré : aperçu et téléchargement seulement";
        return;
    }
    try {
        statuses = await service.statuses();
        banner.className = "ok";
        banner.textContent = `Registre des envois lu à ${parisTime(new Date())}`;
    } catch (e) {
        console.error(e);
        banner.className = "error";
        banner.textContent = `Registre des envois indisponible : ${(e as Error).message}`;
    }
    render();
};

initialise();
