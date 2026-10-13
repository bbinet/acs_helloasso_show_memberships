import { GetItems, MembersData, AdminData, readArchive, seasons } from "./ACSData.js"
import fs from "fs";

const initialise = async () =>
{
    // Saison en cours sur HelloAsso ; saisons archivées (résumés pour les statistiques) dans archives.enc,
    // tenu à jour par archives.sh
    const items = await GetItems(seasons[0]);
    const { archive, error } = await readArchive();
    if (error)
        console.log(`Statistiques sans les saisons archivées : ${error}.`);
    const history = archive ? archive.seasons.map(({ season, summaries }) => ({ season, members: summaries })) : [];
    for (const [fn, data] of [["acs.json", MembersData(items)], ["acs-admin.json", AdminData(items, seasons[0], history)]]) {
        fs.writeFileSync(fn, data);
        console.log(`Wrote data to ${fn}.`);
    }
}

initialise();
