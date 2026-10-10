// Liste des adhérents avec filtre par activité, recherche, tri et pagination (FreeDatas2HTML) :
// utilisée par la page des adhérents et par l'onglet « Adhérents » de la page admin.
// Une seule liste par page : FreeDatas2HTML donne des identifiants fixes à ses champs de recherche et de pagination.
import { FreeDatas2HTML, Pagination, Render, SearchEngine, Selector, SortingField } from "./FreeDatas2HTML";

// Identifiants des éléments de la page qui reçoivent la liste et ses outils
export interface MembersTableElements {
    datas: string;
    count: string;
    filter: string;
    search: string;
    pages: string;
    paginationOptions: string;
}

export interface MembersTableOptions {
    activitiesField: number; // champ filtré par activité (valeurs séparées par des virgules)
    searchFields: number[]; // champs dans lesquels la recherche s'effectue
}

export async function showMembersTable(fields: string[], datas: string[][], elements: MembersTableElements, options: MembersTableOptions)
{
    // Création d'un convertisseur parsant des données transmises en JSON :
    const converter=new FreeDatas2HTML("JSON");
    converter.parser.datas2Parse = `{"fields": ${JSON.stringify(fields)},"datas":${JSON.stringify(datas)}}`;

    // Parsage des données, qui ne sont pas encore affichées :
    await converter.run();

    // Adaptation du rendu suivant la taille de l'écran :
    const render=new Render();
    if(window.innerWidth < 600)
    {
        render.settings = {
            allBegining:"<h4>Affichage petits écrans !</h4>",
            allEnding:"",
            linesBegining:"<ul>",
            linesEnding:"</ul>",
            lineBegining:"<li><ul>",
            lineEnding:"</ul></li>",
            dataDisplaying:"<li><b>#FIELDNAME :</b> #VALUE</li>",
        };
        converter.datasRender=render;
    }
    else
    {
        // Ici, on adapte juste la balise encadrant l'ensemble des données pour passer une classe de paper.css :
        render.settings.allBegining="<table class='table-hover'>";
        converter.datasRender=render;
    }

    // Configuration de la pagination :
    const pagination=new Pagination(converter, { id:elements.pages }, "Page à afficher :");
    pagination.options={ displayElement: { id:elements.paginationOptions }, values: [50,100,200,400,1000] , name: "Nombre de lignes par page :" };
    pagination.selectedValue=100;
    converter.pagination=pagination;
    pagination.options2HTML();

    // Désignation des champs permettant de classer les données :
    // Uniquement avec un rendu sous forme de tableau (grand écran), car des en-têtes de colonne sont nécessaires.
    if(window.innerWidth >= 800)
        // En-têtes cherchés seulement dans la liste : la page admin a d'autres tableaux
        converter.datasSortingFields=fields.map((_, index) => new SortingField(converter, index, `#${elements.datas} th`));

    // Création d'un filtre sur les activités :
    let filter=new Selector(converter, options.activitiesField, { id:elements.filter }, "," );
    filter.filter2HTML("Filtrer par activité");

    // + Un moteur de recherche, mais filtrant les données seulement sur certains champs :
    const search=new SearchEngine(converter, { id:elements.search }, options.searchFields);
    search.label="Rechercher :";
    search.btnTxt="OK";
    // La recherche se lance automatiquement, dès que 2 caractères sont saisis :
    search.automaticSearch=true;
    search.nbCharsForSearch=2;
    search.placeholder="Tapez votre recherche...";
    search.filter2HTML();

    // Injection des filtres dans le convertisseur :
    converter.datasFilters=[filter, search];

    // Affichage initial avec l'id de l'élément HTML devant afficher le compteur :
    converter.datasViewElt={ id:elements.datas };
    converter.datasCounterElt={ id:elements.count };
    converter.refreshView();
}
