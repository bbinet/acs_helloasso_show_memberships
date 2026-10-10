// Affiche en haut de page la date des données (date de génération de la page) et, pour la saison
// en cours, la date de la dernière vérification réussie faite par la GitHub Action cron.yml.
import { parisTime } from "./format";

const lastCheckUrl="https://api.github.com/repos/bbinet/acs_helloasso_show_memberships/actions/workflows/cron.yml/runs?status=success&per_page=1";

// "9 oct. à 17h28" (heure de Paris), avec l'année si ce n'est pas l'année en cours
const format=(date: Date) =>
{
    const options: Intl.DateTimeFormatOptions={ timeZone: "Europe/Paris", day: "numeric", month: "short" };
    if(date.getFullYear() !== new Date().getFullYear())
        options.year="numeric";
    return `${date.toLocaleDateString("fr-FR", options)} à ${parisTime(date)}`;
}

export const showDates=async (current: boolean) =>
{
    const elt=document.getElementById("dates")!;
    elt.textContent=`Données : ${format(new Date(__BUILD_DATE__))}`;
    if(!current)
        return;
    try {
        const response=await fetch(lastCheckUrl);
        const run=(await response.json()).workflow_runs?.[0];
        if(run)
            elt.textContent+=` · Vérification : ${format(new Date(run.run_started_at))}`;
    } catch(e) {
        console.error(e);
    }
}
