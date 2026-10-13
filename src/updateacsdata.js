import { GetItems, MembersData, AdminData, seasons } from "./ACSData.js"
import fs from "fs";

// Saison en cours, sur HelloAsso. Les saisons archivées sont dans archives.enc (voir archives.sh).
const initialise = async () =>
{
    const items = await GetItems(seasons[0]);
    for (const [fn, data] of [["acs.json", MembersData(items)], ["acs-admin.json", AdminData(items)]]) {
        fs.writeFileSync(fn, data);
        console.log(`Wrote data to ${fn}.`);
    }
}

initialise();
