// Génère archives.enc : les données des saisons archivées (toutes les saisons de config.json sauf la première),
// chiffrées avec une clé dérivée du mot de passe admin (voir ArchiveData dans ACSData.js).
// Usage : node src/buildarchives.js [--if-needed]
//   --if-needed : seulement si gh-pages/archives.enc est à régénérer (absent, autre mot de passe, saison ajoutée...)
import fs from "fs";
import { ArchiveData, GetItems, encryptArchiveData, readArchive, seasons } from "./ACSData.js";

const OUTPUT = "archives.enc";

fs.rmSync(OUTPUT, { force: true });
if (process.argv.includes("--if-needed")) {
    const { error } = await readArchive();
    if (!error) {
        console.log("Données des saisons archivées à jour.");
        process.exit(0);
    }
    console.log(`Données des saisons archivées à régénérer : ${error}.`);
}

const archived = seasons.slice(1);
console.log(`Récupération sur HelloAsso des saisons ${archived.map((season) => season.name).join(", ")}...`);
const data = ArchiveData(await Promise.all(archived.map((season) => GetItems(season))));
fs.writeFileSync(OUTPUT, await encryptArchiveData(data));
// Copie en clair, non publiée, pour le serveur de développement (npm run dev)
fs.writeFileSync("acs-archives.json", data);
console.log(`Données des saisons archivées chiffrées dans ${OUTPUT}.`);
