// Affiche le nom de la saison, et sur les pages archivées un lien vers la saison en cours.
// La saison en cours est publiée à la racine du site, les saisons archivées dans archives/<saison>/
export const showSeason=(season: string, current: boolean) =>
{
    document.getElementById("season")!.textContent=season;
    if(!current)
        document.getElementById("seasonsNav")!.innerHTML=`<a href="../../">Saison en cours</a>`;
}
