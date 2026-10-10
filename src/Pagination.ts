import { errors } from './errors';
import {  DOMElement, Paginations, PaginationsOptions, PaginationsPages } from "./interfaces";
import { FreeDatas2HTML } from "./FreeDatas2HTML";

export class Pagination implements Paginations
{
    private _converter: FreeDatas2HTML;
    private _selectedValue: number|undefined;
    private _options: PaginationsOptions|undefined;
    private _pages: PaginationsPages;

    public static isPositiveInteger(nb: number)
    {
       return  (Number.isInteger(nb) === false ||  nb <= 0) ? false : true;
    }

    // Injection de la classe principale, mais uniquement si les données ont été importées
    // L'élément du DOM devant recevoir la liste des pages doit exister
    constructor(converter: FreeDatas2HTML, pagesElt: DOMElement, pagesName="Pages")
    {
        if(converter.fields.length === 0)
            throw new Error(errors.paginationNeedDatas);
        else
        {
            this._pages={ displayElement: FreeDatas2HTML.checkInDOMById(pagesElt), name: pagesName };
            this._converter=converter;
        }
    }

    // undefined = ne pas paginer les données.
    set selectedValue(value : number|undefined)
    {
        if(value !== undefined)
        {
            if(!Pagination.isPositiveInteger(value))
                throw new Error(errors.needPositiveInteger);
            if(this.options !== undefined && this.options.values.indexOf(value) === -1)
                throw new Error(errors.paginationNeedByfaultValueBeInOptions);
        }
        this._selectedValue=value;
    }

    get selectedValue() : number|undefined
    {
        return this._selectedValue;
    }

    // Les différentes valeurs de pagination proposées
    set options(options : PaginationsOptions|undefined)
    {
        if(options !== undefined)
        {
            options.displayElement=FreeDatas2HTML.checkInDOMById(options.displayElement);
            // Dédoublonnage et refus des valeurs incorrectes.
            // Par contre pas de classement des valeurs restantes, car le "désordre" peut être volontaire :)
            const realValues=[];
            for(let option of options.values)
            {
                if(! Pagination.isPositiveInteger(option))
                    throw new Error(errors.needPositiveInteger);
                if(realValues.indexOf(option) === -1)
                    realValues.push(option);
                else
                    console.log(errors.paginationOptionsDuplicatedValues);
            }
           if(realValues.length < 2)
                throw new Error(errors.paginationNeedOptionsValues);
            options.values=realValues;
            if(this.selectedValue !== undefined && options.values.indexOf(this.selectedValue) === -1)
                throw new Error(errors.paginationNeedByfaultValueBeInOptions);
            options.name=(options.name === undefined)  ?  "Pagination" : options.name ; // chaîne vide possible, si souhaité
        }
        this._options=options;
    }

    get options() : PaginationsOptions|undefined
    {
        return this._options;
    }

    get pages() : PaginationsPages
    {
        return this._pages;
    }

    // Création du <select> permettant de choisir la pagination : « 100 par page », ..., « Toutes »
    // (comme dans l'onglet « Factures et exports » de la page admin)
    public options2HTML() : void
    {
        if(this._options === undefined)
            throw new Error(errors.pagination2HTMLFail);
        else
        {
            let selectorsHTML="<select name='freeDatas2HTMLPaginationSelector' id='freeDatas2HTMLPaginationSelector' aria-label='"+this._options.name+"'>";
            for(let i=0; i< this._options.values.length; i++)
                 selectorsHTML+="<option value='"+(i+1)+"'>"+this._options.values[i]+" par page</option>";
            selectorsHTML+="<option value='0'>Toutes</option></select>";
            this._options.displayElement.eltDOM!.innerHTML=selectorsHTML; // "!" car displayElement testé par le constructeur
            
            let selectElement=document.getElementById("freeDatas2HTMLPaginationSelector") as HTMLInputElement;
            
            if(this._selectedValue !== undefined)
                selectElement.value=""+(this._options.values.indexOf(this._selectedValue)+1);

            const pagination=this;
            selectElement.addEventListener("change", function()
           {
                if(selectElement.value === "0")
                    pagination._selectedValue=undefined; // = pas de pagination
                else                 
                    pagination._selectedValue=pagination._options!.values[Number(selectElement.value)-1];
                pagination._converter.refreshView();
            }); 
        }
    }

    // Création des boutons permettant de se déplacer entre les pages, la page affichée étant mise en évidence
    // (comme dans l'onglet « Factures et exports » de la page admin)
    public pages2HTML() : void
    {
         if (this._selectedValue === undefined || this._converter.nbDatasValid <= this._selectedValue)
            this.pages.displayElement.eltDOM!.innerHTML=""; // "!" car displayElement testé par le constructeur
         else
         {
            let nbPages=Math.ceil(this._converter.nbDatasValid/this._selectedValue);
            const current=this.pages.selectedValue ?? 1;
            this.pages.values=[];
            let buttonsHTML="";
            for(let j=1; j <= nbPages; j++)
            {
                buttonsHTML+="<button class='btn-small"+(j === current ? " btn-secondary" : "")+"' data-page='"+j+"' aria-label='"+this.pages.name+" "+j+"'>"+j+"</button>";
                this.pages.values.push(j);
            }
            const displayElement=this.pages.displayElement.eltDOM!;
            displayElement.innerHTML=buttonsHTML;

            const pagination=this;
            displayElement.querySelectorAll<HTMLButtonElement>("button").forEach((button) => button.addEventListener("click", function()
            {
                pagination.pages.selectedValue=Number(button.dataset.page);
                pagination._converter.refreshView(true);
                // Mise en évidence de la page dont on vient de demander l'affichage :
                pagination.pages2HTML();
            }));
        }
    }
}
