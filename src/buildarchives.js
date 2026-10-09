// Régénère les pages des saisons archivées (toutes les saisons de config.json sauf la première)
// dans dist/archives/<saison>/index.html, ainsi que la page dist/archives/index.html qui les liste.
import { build } from "vite";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import cfg from "../config.json" with { type: "json" };
import { GetData, seasons, seasonDir } from "./ACSData.js";

const outDir = "dist/archives";
const dataDir = "acs-archives";
const archived = seasons.slice(1);

fs.rmSync(outDir, { recursive: true, force: true });
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

for (const season of archived) {
    const dir = path.join(outDir, seasonDir(season));
    const dataFile = path.resolve(dataDir, `${seasonDir(season)}.json`);
    console.log(`Saison ${season.name} : récupération des données HelloAsso...`);
    fs.writeFileSync(dataFile, await GetData(season));

    // Même page que la saison en cours, mais construite avec les données de cette saison :
    await build({
        logLevel: "warn",
        publicDir: false,
        resolve: { alias: [{ find: /^\.\.\/acs\.json$/, replacement: dataFile }] },
        build: { outDir: dir, emptyOutDir: true },
    });
    execFileSync("node_modules/.bin/staticrypt", [
        path.join(dir, "index.html"), "-d", dir,
        "-p", cfg.credentials.staticrypt.password,
        "--template-title", "ACS adhésions",
        "--template-button", "Se connecter",
    ], { stdio: "inherit" });
}

const links = archived
    .map((season) => `      <li><a href="${seasonDir(season)}/">Saison ${season.name}</a></li>`)
    .join("\n");
fs.writeFileSync(path.join(outDir, "index.html"), `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Adhésions ACS - saisons précédentes</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/papercss@1.9.2/dist/paper.min.css" />
  </head>
  <body class="paper container-lg">
    <h2>Adhésions ACS - saisons précédentes</h2>

    <ul>
${links}
    </ul>

    <p><a href="../">Saison en cours</a></p>
  </body>
</html>
`);
console.log(`Pages d'archives générées dans ${outDir}/.`);
