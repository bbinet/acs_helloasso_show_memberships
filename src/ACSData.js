import { ApiV5Client as HelloAsso } from "helloasso";
import cfg from "../config.json" with { type: "json" };

function title(str) {
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Saisons déclarées dans config.json, de la plus récente à la plus ancienne :
// la première est la saison en cours, les suivantes sont archivées.
export const seasons = cfg.conf.seasons;

// Nom du répertoire d'archive d'une saison : "2025/2026" => "2025-2026"
export const seasonDir = (season) => season.name.replace(/\//g, "-");

export const GetData = async (season = seasons[0]) =>
{
    const helloAsso = new HelloAsso({
        apiBase: cfg.conf.helloasso.api_base,
        clientId: cfg.credentials.helloasso.id,
        clientSecret:cfg.credentials.helloasso.secret,
    });
    let totalPages;
    let payload = {
        withDetails: "true",
        pageSize: 100
    };
    let members = [];
    let continuationToken = null;
    while (true) {
        const resp = await helloAsso.call(`/v5/organizations/${cfg.conf.helloasso.organization_name}/forms/${cfg.conf.helloasso.formType}/${season.formSlug}/items?${new URLSearchParams(payload)}`);
        const resp_json = await resp.json();
        if (!resp_json.data || resp_json.data.length <= 0) {
            break;
        }
        continuationToken = resp_json.pagination.continuationToken;
        payload.continuationtoken = continuationToken;
        //console.log(resp_json);
        for (let item of resp_json.data) {
            if (item.payments && item.payments[0].refundOperations.length > 0) {
                continue;
            }
            // Adhésion anonymisée par HelloAsso (pas d'adhérent et payeur vide) :
            if (!item.user) {
                continue;
            }
            let options = (item.options ?? []).map((elt) => elt.name);
            members.push([
                title(item.user.firstName.trim()),
                title(item.user.lastName.trim()),
                item.customFields.find((elt) => elt.name == "Société").answer.toUpperCase(),
                item.payer.email,
                options.join(", ")
            ]);
        }
    }

    return JSON.stringify({
        season: season.name,
        current: season.name === seasons[0].name,
        fields: ["Prénom", "Nom", "Entreprise", "Email", "Activités"],
        datas: members,
    });
}
