// Adhérents d'une saison dans le terminal, lus directement sur HelloAsso avec config.json :
//   ./cli.sh --help
import { parseArgs } from "node:util";
import { GetItems, seasonDir, seasons } from "./ACSData.js";
import { buildInvoice, type Invoice } from "./InvoiceData.js";
import { checkPattern, completionScript, FORMATS, formatMembers, formatPattern, OPTIONS, PATTERN_FIELDS, selectMembers } from "./MembersCli";

const HELP = `Usage : ./cli.sh [options]

Adhésions de la saison (adhésions remboursées exclues), lues sur HelloAsso.

Sélection :
  --season <saison>      saison de config.json, par ex. 2025-2026 (défaut : ${seasons[0].name})
  --search <texte>       nom, prénom, entreprise, email ou n° d'adhésion (sans accents ni majuscules)
  --activity <regex>     au moins une activité correspondante, par ex. "foot|tennis"
  --formula <regex>      tarif correspondant, par ex. gymnases
  --from <AAAA-MM-JJ>    inscrits à partir de cette date
  --to <AAAA-MM-JJ>      inscrits jusqu'à cette date (comprise)

Affichage :
  --format <format>      ${FORMATS.join(", ")} (défaut : ${OPTIONS.format.default})
                           csv : comme l'export de la page admin
                           emails : adresses à coller dans un email, sans doublon
                           summary : nombre d'adhérents par activité
                           summary-members : idem, avec les adhérents de chaque activité
  --pattern <modèle>     une ligne par adhésion, par ex. '"{firstName} {lastName}" <{email}>'
                           champs : ${PATTERN_FIELDS.join(" ")}
  --completion <shell>   script de complétion pour bash ou zsh (voir le README)
  -h, --help             cette aide
`;

function fail(message: string): never {
    console.error(`${message}\n\n${HELP}`);
    process.exit(2);
}

// Erreur d'utilisation : message et aide
function orFail<T>(action: () => T): T {
    try {
        return action();
    } catch (error) {
        fail((error as Error).message);
    }
}

const { values: options } = orFail(() => parseArgs({ options: OPTIONS }));
if (options.help) {
    console.log(HELP);
    process.exit(0);
}
if (options.completion) {
    console.log(orFail(() => completionScript(options.completion!, seasons.map(seasonDir))));
    process.exit(0);
}

// Arguments vérifiés avant de lire les adhésions sur HelloAsso
if (!FORMATS.includes(options.format!))
    fail(`Format inconnu : ${options.format}`);
for (const bound of ["from", "to"] as const)
    if (options[bound] && !/^\d{4}-\d{2}-\d{2}$/.test(options[bound]!))
        fail(`Date invalide pour --${bound} : ${options[bound]} (attendu : AAAA-MM-JJ)`);
for (const regex of ["activity", "formula"] as const)
    if (options[regex])
        orFail(() => new RegExp(options[regex]!));
if (options.pattern)
    orFail(() => checkPattern(options.pattern!));
const seasonName = seasonDir({ name: options.season ?? seasons[0].name });
const season = seasons.find((s: { name: string }) => seasonDir(s) === seasonName)
    ?? fail(`Saison inconnue : ${options.season} (saisons de config.json : ${seasons.map(seasonDir).join(", ")})`);

// Traces de la bibliothèque helloasso : avertissements seulement, sur la sortie d'erreur
const warningsOnStderr = () => ({ warn: console.error });
let members: Invoice[];
try {
    const invoices = (await GetItems(season, warningsOnStderr)).map(buildInvoice).filter(Boolean) as Invoice[];
    members = selectMembers(invoices, options);
} catch (error) {
    console.error((error as Error).message);
    process.exit(1);
}

const output = options.pattern
    ? members.map((member) => formatPattern(member, options.pattern!)).join("\n")
    : formatMembers(members, options.format!);
if (output)
    console.log(output);
// Sur la sortie d'erreur, pour garder un CSV ou une liste d'emails propre en cas de redirection
console.error(`${members.length} adhésion(s), saison ${season.name}`);
