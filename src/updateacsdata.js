import { GetData } from "./ACSData.js"
import fs from "fs";

const initialise = async () =>
{
    const data = await GetData();
    const fn = `acs.json`;
    fs.writeFile(fn, data, () => {
        console.log(`Wrote data to ${fn}.`);
    });
}

initialise();
