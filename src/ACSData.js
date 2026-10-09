import { ApiV5Client as HelloAsso } from "helloasso";
import cfg from "../config.json" with { type: "json" };
import fs from "fs";
import { buildInvoice, isBillable } from "./InvoiceData.js";

function title(str) {
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Saisons déclarées dans config.json, de la plus récente à la plus ancienne :
// la première est la saison en cours, les suivantes sont archivées.
export const seasons = cfg.conf.seasons;

// Nom du répertoire d'archive d'une saison : "2025/2026" => "2025-2026"
export const seasonDir = (season) => season.name.replace(/\//g, "-");

// Adhésions de la saison, telles que renvoyées par l'API HelloAsso
export const GetItems = async (season = seasons[0]) =>
{
    const helloAsso = new HelloAsso({
        apiBase: cfg.conf.helloasso.api_base,
        clientId: cfg.credentials.helloasso.id,
        clientSecret:cfg.credentials.helloasso.secret,
    });
    let payload = {
        withDetails: "true",
        pageSize: 100
    };
    let items = [];
    while (true) {
        const resp = await helloAsso.call(`/v5/organizations/${cfg.conf.helloasso.organization_name}/forms/${cfg.conf.helloasso.formType}/${season.formSlug}/items?${new URLSearchParams(payload)}`);
        const resp_json = await resp.json();
        if (!resp_json.data || resp_json.data.length <= 0) {
            break;
        }
        payload.continuationtoken = resp_json.pagination.continuationToken;
        items.push(...resp_json.data);
    }
    return items;
}

// Données de la page des adhérents (acs.json)
export const MembersData = (items, season = seasons[0]) =>
{
    let members = [];
    // Adhésions remboursées, ou anonymisées par HelloAsso (pas d'adhérent et payeur vide) : ignorées
    for (let item of items.filter(isBillable)) {
        let options = (item.options ?? []).map((elt) => elt.name);
        members.push([
            title(item.user.firstName.trim()),
            title(item.user.lastName.trim()),
            item.customFields.find((elt) => elt.name == "Société").answer.toUpperCase(),
            item.payer.email,
            options.join(", ")
        ]);
    }

    return JSON.stringify({
        season: season.name,
        current: season.name === seasons[0].name,
        fields: ["Prénom", "Nom", "Entreprise", "Email", "Activités"],
        datas: members,
    });
}

// Données de la page d'administration (acs-admin.json) : factures et paramètres d'envoi.
// Contient l'adresse et le jeton du script d'envoi : ne doit être intégré qu'à la page admin.
export const AdminData = (items, season = seasons[0]) =>
{
    const invoicing = cfg.conf.invoicing ?? {};
    const credentials = cfg.credentials.invoicing ?? {};
    return JSON.stringify({
        season: season.name,
        invoices: items.map(buildInvoice).filter(Boolean),
        // Signataire des factures (modèle template.jinja2 d'acs_helloasso_invoicing)
        issuer: invoicing.issuer ?? {
            name: "Nathalie Baillet",
            title: "Trésorière, membre du CA de l'ACS",
            email: "acs.tresorier@gmail.com",
        },
        // Image de la signature : fichier signature.png, s'il existe (secret INVOICE_SIGNATURE dans GitHub Actions)
        signature: fs.existsSync("signature.png") ? `data:image/png;base64,${fs.readFileSync("signature.png").toString("base64")}` : null,
        service: credentials.script_url ? { url: credentials.script_url, token: credentials.token } : null,
    });
}

export const GetData = async (season = seasons[0]) => MembersData(await GetItems(season), season);
