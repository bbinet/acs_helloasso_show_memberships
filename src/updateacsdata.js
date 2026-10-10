import { GetItems, MembersData, AdminData, SeasonSummary, seasons, seasonDir } from "./ACSData.js"
import fs from "fs";

// Résumés des saisons archivées, sans données personnelles : une saison terminée ne change plus, elle n'est
// donc récupérée sur HelloAsso qu'une fois, puis gardée dans ce répertoire (mis en cache par GitHub Actions)
const HISTORY_DIR = "acs-history";

const archivedSeason = async (season) =>
{
    const file = `${HISTORY_DIR}/${seasonDir(season)}.json`;
    if (fs.existsSync(file))
        return JSON.parse(fs.readFileSync(file, "utf8"));
    const summary = { season: season.name, members: SeasonSummary(await GetItems(season)) };
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(summary));
    console.log(`Wrote ${file}.`);
    return summary;
}

const initialise = async () =>
{
    // Saison en cours et saisons archivées (de la plus récente à la plus ancienne), récupérées en parallèle
    const [items, ...history] = await Promise.all([GetItems(seasons[0]), ...seasons.slice(1).map(archivedSeason)]);
    for (const [fn, data] of [["acs.json", MembersData(items)], ["acs-admin.json", AdminData(items, seasons[0], history)]]) {
        fs.writeFileSync(fn, data);
        console.log(`Wrote data to ${fn}.`);
    }
}

initialise();
