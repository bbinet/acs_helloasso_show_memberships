import 'papercss'
import './style.css'
import { FreeDatas2HTML, Pagination, Render, SearchEngine, Selector, SortingField } from "./FreeDatas2HTML";
import { GetData } from "./ACSData"

const initialise=async () =>
{
    try {
        // Création d'un convertisseur parsant des données transmises en JSON :
        const converter=new FreeDatas2HTML("JSON");
        converter.parser.datas2Parse= await GetData()

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
        const pagination=new Pagination(converter, { id:"pages" }, "Page à afficher :");
        pagination.options={ displayElement: { id:"paginationOptions" }, values: [50,100,200,400,1000] , name: "Nombre de lignes par page :" };
        pagination.selectedValue=100;
        converter.pagination=pagination;
        pagination.options2HTML();

        // Désignation des champs permettant de classer les données :
        // Uniquement avec un rendu sous forme de tableau (grand écran), car des en-têtes de colonne sont nécessaires.
        if(window.innerWidth >= 800)
        {
            converter.datasSortingFields=[
                new SortingField(converter, 0),
                new SortingField(converter, 1),
                new SortingField(converter, 2),
                new SortingField(converter, 3),
                new SortingField(converter, 4),
                ]
        }
                
        // Création d'un filtre sur la premier champ :
        let filter=new Selector(converter, 4, { id:"filter"}, "," );
        //filter.isMultiple = true;
        filter.filter2HTML("Filtrer par activité");

        // + Un moteur de recherche, mais filtrant les données seulement sur les 3 premiers champs:
        const search=new SearchEngine(converter, { id:"search" }, [0,1,2]);
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
        converter.datasViewElt={  id:"datas" };
        converter.datasCounterElt={ id:"count" };
        converter.refreshView(); 

    } catch(e) {
        console.error(e);
        document.getElementById("datas")!.innerHTML=`<div class="alert alert-warning">Désolé, mais un problème technique empêche l'affichage des données.</div>`;
    }
}

initialise();
