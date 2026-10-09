import { GetItems, MembersData, AdminData } from "./ACSData.js"
import fs from "fs";

const initialise = async () =>
{
    const items = await GetItems();
    for (const [fn, data] of [["acs.json", MembersData(items)], ["acs-admin.json", AdminData(items)]]) {
        fs.writeFileSync(fn, data);
        console.log(`Wrote data to ${fn}.`);
    }
}

initialise();
