import { GetItems, MembersData, AdminData, SeasonDates, seasons } from "./ACSData.js"
import fs from "fs";

// Saisons archivées comparées à la saison en cours dans les statistiques de la page admin
const COMPARED_SEASONS = 2;

const initialise = async () =>
{
    // Saison en cours et saisons comparées (seulement leurs dates d'inscription), récupérées en parallèle
    const [items, ...archived] = await Promise.all([seasons[0], ...seasons.slice(1, 1 + COMPARED_SEASONS)].map((season) => GetItems(season)));
    const history = archived.map((archivedItems, index) => ({ season: seasons[index + 1].name, dates: SeasonDates(archivedItems) }));
    for (const [fn, data] of [["acs.json", MembersData(items)], ["acs-admin.json", AdminData(items, seasons[0], history)]]) {
        fs.writeFileSync(fn, data);
        console.log(`Wrote data to ${fn}.`);
    }
}

initialise();
