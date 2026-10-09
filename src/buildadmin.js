// Construit la page d'administration (factures) dans dist/admin/index.html, chiffrée avec son propre
// mot de passe (credentials.staticrypt.admin_password), différent de celui de la page des adhérents.
import { build } from "vite";
import { execFileSync } from "child_process";
import cfg from "../config.json" with { type: "json" };

const password = cfg.credentials.staticrypt.admin_password;
if (!password) {
    console.log("Pas de mot de passe admin (credentials.staticrypt.admin_password) : page admin non générée.");
    process.exit(0);
}

await build({
    logLevel: "warn",
    publicDir: false,
    build: { outDir: "dist", emptyOutDir: false, rollupOptions: { input: "admin/index.html" } },
});
execFileSync("node_modules/.bin/staticrypt", [
    "dist/admin/index.html", "-d", "dist/admin",
    "-p", password,
    "--template-title", "ACS factures",
    "--template-button", "Se connecter",
], { stdio: "inherit" });
console.log("Page admin générée dans dist/admin/.");
