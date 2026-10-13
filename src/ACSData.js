import { ApiV5Client as HelloAsso } from "helloasso";
import cfg from "../config.json" with { type: "json" };
import fs from "fs";
import { activityNames, buildInvoice, isBillable, summarize } from "./InvoiceData.js";
import { decryptArchive, deriveArchiveKey, encryptArchive } from "./ArchiveCrypto.js";

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

const MEMBER_FIELDS = ["Prénom", "Nom", "Entreprise", "Email", "Activités"];

// Lignes de la liste des adhérents, une par adhésion
// (adhésions remboursées, ou anonymisées par HelloAsso — pas d'adhérent et payeur vide — ignorées)
const memberRows = (items) => items.filter(isBillable).map((item) => [
    title(item.user.firstName.trim()),
    title(item.user.lastName.trim()),
    item.customFields.find((elt) => elt.name == "Société").answer.toUpperCase(),
    item.payer.email,
    activityNames(item).join(", "),
]);

// Données de la page des adhérents (acs.json)
export const MembersData = (items, season = seasons[0]) => JSON.stringify({
    season: season.name,
    current: season.name === seasons[0].name,
    fields: MEMBER_FIELDS,
    datas: memberRows(items),
});

// Données de la page d'administration (acs-admin.json) : factures et paramètres d'envoi.
// Contient l'adresse et le jeton du script d'envoi : ne doit être intégré qu'à la page admin.
// Les saisons archivées n'y sont pas : la page les télécharge quand elle en a besoin (archives.enc)
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
        // Noms des saisons archivées, pour les proposer avant d'avoir téléchargé leurs données
        archivedSeasons: archivedSeasons(),
    });
}

// Adhésions d'une saison (non remboursées), résumées sans données personnelles (voir summarize)
export const SeasonSummary = (items) => items.map(buildInvoice).filter(Boolean).map(summarize);

export const GetData = async (season = seasons[0]) => MembersData(await GetItems(season), season);

// Données des saisons archivées (toutes celles de config.json sauf la première), publiées chiffrées dans
// archives.enc : liste des adhérents (onglet Adhérents de la page admin) et adhésions résumées (statistiques).
// Une saison terminée ne changeant plus, elles ne sont récupérées sur HelloAsso qu'une fois (voir archives.sh).
export const ARCHIVE_FILE = "gh-pages/archives.enc";
// À augmenter quand le contenu change : le cron régénère alors archives.enc
// (2 : sans l'option « N'oubliez pas ... » dans les activités des adhérents)
export const ARCHIVE_VERSION = 2;
export const archivedSeasons = () => seasons.slice(1).map((season) => season.name);

// seasonsItems : adhésions HelloAsso de chaque saison archivée, de la plus récente à la plus ancienne
export const ArchiveData = (seasonsItems) => JSON.stringify({
    version: ARCHIVE_VERSION,
    fields: MEMBER_FIELDS,
    seasons: seasons.slice(1).map((season, i) =>
        ({ season: season.name, members: memberRows(seasonsItems[i]), summaries: SeasonSummary(seasonsItems[i]) })),
});

// Clé de archives.enc, dérivée du mot de passe de la page admin
export const archiveKey = () => deriveArchiveKey(cfg.credentials.staticrypt.admin_password);

export const encryptArchiveData = async (data) => encryptArchive(data, await archiveKey());

// Contenu de archives.enc, ou la raison pour laquelle il est à régénérer : absent, chiffré avec une autre clé
// (mot de passe admin changé), d'une autre version, ou sans toutes les saisons archivées de config.json
export const readArchive = async () =>
{
    if (!fs.existsSync(ARCHIVE_FILE))
        return { error: `${ARCHIVE_FILE} absent` };
    let archive;
    try {
        archive = JSON.parse(await decryptArchive(fs.readFileSync(ARCHIVE_FILE), await archiveKey()));
    } catch {
        return { error: `${ARCHIVE_FILE} ne se déchiffre pas avec le mot de passe admin` };
    }
    if (archive.version !== ARCHIVE_VERSION)
        return { error: `${ARCHIVE_FILE} : version ${archive.version} au lieu de ${ARCHIVE_VERSION}` };
    const names = archive.seasons.map((season) => season.season);
    if (names.join() !== archivedSeasons().join())
        return { error: `${ARCHIVE_FILE} : saisons ${names.join(", ")} au lieu de ${archivedSeasons().join(", ")}` };
    return { archive };
}
