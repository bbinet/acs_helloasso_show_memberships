// Sélection et mise en forme des adhésions pour la commande « npm run members » (members.ts), dans le terminal
import type { Invoice } from "./InvoiceData.js";
import { filterInvoices, type FilterCriteria } from "./InvoiceFilter";
import { byActivity } from "./Stats";
import { emailList, toCsv } from "./Export";
import { euros, frenchDate } from "./format";

export interface MemberCriteria {
    search?: string; // nom, entreprise, email ou n°, comme la page admin
    activity?: string; // expression régulière sur les noms d'activités
    formula?: string; // expression régulière sur le nom du tarif
    from?: string; // période d'inscription, bornes comprises (AAAA-MM-JJ)
    to?: string;
}

const regex = (pattern: string | undefined) => (pattern ? new RegExp(pattern, "i") : null);

export function selectMembers(invoices: Invoice[], criteria: MemberCriteria): Invoice[] {
    const activity = regex(criteria.activity);
    const formula = regex(criteria.formula);
    const filters: FilterCriteria = { search: criteria.search, from: criteria.from, to: criteria.to };
    return filterInvoices(invoices, {}, filters).filter((invoice) =>
        (!activity || invoice.activities.some((name) => activity.test(name)))
        && (!formula || formula.test(invoice.formula)));
}

// Champs utilisables dans un modèle de texte (--pattern)
const FIELDS: Record<string, (invoice: Invoice) => string> = {
    id: (invoice) => String(invoice.id),
    date: (invoice) => frenchDate(invoice.date),
    firstName: (invoice) => invoice.firstName,
    lastName: (invoice) => invoice.lastName,
    company: (invoice) => invoice.company,
    email: (invoice) => invoice.email,
    phone: (invoice) => invoice.phone,
    formula: (invoice) => invoice.formula,
    activities: (invoice) => invoice.activities.join(", "),
    total: (invoice) => euros(invoice.total),
};

export const PATTERN_FIELDS = Object.keys(FIELDS).map((name) => `{${name}}`);
const PATTERN_FIELD = /\{(\w+)\}/g;

// Erreur si le modèle utilise un champ inconnu : à vérifier avant de lire les adhésions sur HelloAsso
export function checkPattern(pattern: string): void {
    for (const [, name] of pattern.matchAll(PATTERN_FIELD))
        if (!FIELDS[name])
            throw new Error(`Champ inconnu : {${name}}. Champs possibles : ${PATTERN_FIELDS.join(", ")}`);
}

// « "{firstName} {lastName}" <{email}> » => « "Marie Bérard" <marie@example.com> »
export function formatPattern(invoice: Invoice, pattern: string): string {
    checkPattern(pattern);
    return pattern.replace(PATTERN_FIELD, (_, name: string) => FIELDS[name](invoice));
}

const nameAndCompany = (invoice: Invoice) => `${invoice.firstName} ${invoice.lastName}${invoice.company ? ` (${invoice.company})` : ""}`;

// Une adhésion sur quelques lignes, numérotées, séparées par un trait
export function formatText(invoices: Invoice[]): string {
    return invoices.map((invoice, index) => [
        `${String(index + 1).padStart(3)}. N°${invoice.id} le ${frenchDate(invoice.date)} — ${invoice.formula}`,
        `     ${nameAndCompany(invoice)}`,
        `     ${[invoice.email, invoice.phone].filter(Boolean).join(" - ")}`,
        `     ${invoice.activities.join(" - ") || "(aucune activité)"}`,
    ].join("\n")).join(`\n${"-".repeat(80)}\n`);
}

// Effectif de chaque activité (la plus suivie d'abord, sans activité en dernier), avec ou sans ses adhérents
export function formatSummary(invoices: Invoice[], withMembers: boolean): string {
    return byActivity(invoices).map((group) => {
        const title = `${group.name} : ${group.count}`;
        if (!withMembers)
            return title;
        const names = group.members.map(nameAndCompany).sort((a, b) => a.localeCompare(b, "fr"));
        return [title, ...names.map((name) => `    ${name}`)].join("\n");
    }).join(withMembers ? "\n\n" : "\n");
}

// Formats de sortie (--format), le premier par défaut
const FORMATTERS: Record<string, (invoices: Invoice[]) => string> = {
    text: formatText,
    csv: (invoices) => toCsv(invoices, {}),
    json: (invoices) => JSON.stringify(invoices, null, 2),
    emails: emailList,
    summary: (invoices) => formatSummary(invoices, false),
    "summary-members": (invoices) => formatSummary(invoices, true),
};
export const FORMATS = Object.keys(FORMATTERS);

export function formatMembers(invoices: Invoice[], format: string): string {
    return FORMATTERS[format](invoices);
}
export const SHELLS = ["bash", "zsh"];

// Options de la commande, partagées par l'analyse des arguments et la complétion
export const OPTIONS = {
    season: { type: "string" },
    search: { type: "string" },
    activity: { type: "string" },
    formula: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    format: { type: "string", default: FORMATS[0] },
    pattern: { type: "string" },
    completion: { type: "string" },
    help: { type: "boolean", short: "h" },
} as const;

// Complétion de ./cli.sh (voir la section « Ligne de commande » du README)
export function completionScript(shell: string, seasons: string[]): string {
    if (!SHELLS.includes(shell))
        throw new Error(`Shell inconnu : ${shell} (shells possibles : ${SHELLS.join(", ")})`);
    const values: Record<string, string[]> = { format: FORMATS, season: seasons, completion: SHELLS };
    const options = Object.keys(OPTIONS).map((name) => `--${name}`);
    // Options à valeur libre : rien à proposer
    const free = Object.entries(OPTIONS).filter(([name, option]) => option.type === "string" && !values[name]).map(([name]) => `--${name}`);
    return [
        ...(shell === "zsh" ? ["autoload -U +X compinit && compinit", "autoload -U +X bashcompinit && bashcompinit"] : []),
        "_acs_members() {",
        '    local cur="${COMP_WORDS[COMP_CWORD]}" prev="${COMP_WORDS[COMP_CWORD-1]}"',
        '    case "$prev" in',
        ...Object.entries(values).map(([name, words]) => `        --${name}) COMPREPLY=($(compgen -W "${words.join(" ")}" -- "$cur")) ;;`),
        `        ${free.join("|")}) COMPREPLY=() ;;`,
        `        *) COMPREPLY=($(compgen -W "${options.join(" ")}" -- "$cur")) ;;`,
        "    esac",
        "}",
        "complete -F _acs_members cli.sh ./cli.sh",
    ].join("\n");
}
