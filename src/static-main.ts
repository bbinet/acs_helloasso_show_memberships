import 'papercss'
import './style.css'
import { showSeason } from "./Season";
import { showDates } from "./Dates";
import { showMembersTable } from "./MembersTable";
import { season, current, fields, datas } from "../acs.json"

const initialise=async () =>
{
    try {
        showSeason(season, current);
        showDates(current);
        // Filtre sur les activités (5e champ), recherche sur le prénom, le nom et l'entreprise
        await showMembersTable(fields, datas,
            { datas:"datas", count:"count", filter:"filter", search:"search", pages:"pages", paginationOptions:"paginationOptions" },
            { activitiesField:4, searchFields:[0,1,2] });
    } catch(e) {
        console.error(e);
        document.getElementById("datas")!.innerHTML=`<div class="alert alert-warning">Désolé, mais un problème technique empêche l'affichage des données.</div>`;
    }
}

initialise();
