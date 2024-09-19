import { errors } from './errors';
import {  DOMElement, Filters, SearchModeSettings } from "./interfaces";
import { FreeDatas2HTML } from "./FreeDatas2HTML";

export class SearchEngine implements Filters
{
    private _converter: FreeDatas2HTML;
    private _datasViewElt: DOMElement={ id: "", eltDOM: undefined };
    private _btnTxt: string="Search";
    private _fields2Search: string[]=[];
    public label: string="";
    public nbCharsForSearch : number=0;
    public placeholder: string="";
    public automaticSearch: boolean=false;
    private _inputValue: string="";
    public searchMode:SearchModeSettings= // par défaut, recherche lâche, mais peut devenir stricte en passant tout à false
    {
        accentOff: true,
        caseOff: true,
        separatedWords: true, // doit-on chercher l'expression en entier ou chacun des mots ?
        specialCharsOff: true,
        specialCharsWhiteList: "",
    }
    
    // Injection de la classe principale, mais uniquement si des données ont été importées
    constructor(converter: FreeDatas2HTML, elt: DOMElement, fields?: number[])
    {
        if(converter.fields.length === 0 || converter.datas.length === 0)
            throw new Error(errors.filterNeedDatas);
        else
        {
            this._datasViewElt=FreeDatas2HTML.checkInDOMById(elt);
            this._converter=converter;
            // Les champs sur lesquels les recherches seront lancées.
            // Ils doivent se trouver dans les données parsées, mais peuvent ne pas être affichés dans les données.
            // Un tableau vide est accepté et signifie que les recherches se feront sur tous les champs.
            if(fields !== undefined && fields.length !== 0)
            {
                for(let field of fields)
                {
                    if(! this._converter.checkFieldExist(field))
                        throw new Error(errors.searchFieldNotFound);
                    else
                        this._fields2Search.push(this.converter.fields[field]);
                }
            }
            else
                this._fields2Search=this._converter.fields;
        }
    }

    get converter() : FreeDatas2HTML
    {
        return this._converter;
    }

    get datasViewElt() : DOMElement
    {
        return this._datasViewElt;
    }

    set btnTxt(txt: string)
    {
        if(txt.trim() !== "" && txt.length <= 30)
            this._btnTxt=txt;
        else
            console.error(errors.searchBtnTxtFail);
    }

    get btnTxt(): string
    {
        return this._btnTxt;
    }

    get inputValue() : string
    {
        return this._inputValue;
    }

    get fields2Search() : string[]
    {
        return this._fields2Search;
    }

    // Création du champ de recherche dans le DOM.
    public filter2HTML() : void
    {
        if(this.nbCharsForSearch > 0 && this.placeholder === "")
            this.placeholder="Please enter at least NB characters."
        // Pas de minlength ou de required, car l'envoi d'une recherche vide doit permettre d'annuler le filtre.
        let html=`<form id="freeDatas2HTMLSearch">`;
        if(this.label !== "")
            html+=`<label for="freeDatas2HTMLSearchTxt">${this.label}</label>`;
        html+=`<input type="search" id="freeDatas2HTMLSearchTxt" name="freeDatas2HTMLSearchTxt"`;
        if(this.nbCharsForSearch > 0)
            html+=` placeholder="${this.placeholder.replace("NB", ""+this.nbCharsForSearch)}"`;
        else if(this.placeholder !== "")
            html+=` placeholder="${this.placeholder}"`;
        html+=`>&nbsp;<input type="submit" id="freeDatas2HTMLSearchBtn" value="${this._btnTxt}"></form>`;
        this. _datasViewElt.eltDOM!.innerHTML=html;// "!" car l'existence de "eltDOM" est testé par le constructeur

        // L'affichage est actualisé quand l'éventuel nombre de caractères est atteint ou quand le champ est vidé, car cela permet d'annuler ce filtre.
        const searchInput=document.getElementById("freeDatas2HTMLSearchTxt") as HTMLInputElement, mySearch=this;
        searchInput.addEventListener("input", function(e)
       {
            e.preventDefault();
            mySearch._inputValue=searchInput.value.trim();
            const searchLength=mySearch._inputValue.length;
            if(mySearch.automaticSearch && (mySearch.nbCharsForSearch === 0 || ( searchLength === 0) || (searchLength >= mySearch.nbCharsForSearch)))
                mySearch._converter.refreshView();
        });

        // Lorsque le bouton est cliqué, la recherche est lancée, quelque soit le nombre de caractères saisis.
        const searchBtn=document.getElementById("freeDatas2HTMLSearchBtn") as HTMLInputElement;
        searchBtn.addEventListener("click", function(e)
       {
            e.preventDefault();
            mySearch._converter.refreshView();
        });
    }

    // Pré-traitement des chaînes de caractères à comparer, suivant le mode de recherche
    private searchPreProcessing(searchElement: string) : string
    {
        let finalString=searchElement;
        if(this.searchMode.accentOff) // caractères accentués remplacés (exemple : "é" -> "e")
            finalString=finalString.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // cf. https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
        if(this.searchMode.caseOff)
            finalString=finalString.toLowerCase();
        if(this.searchMode.specialCharsOff)
        {
            // Suppression de tous les caractères "spéciaux", c'est-à-dire n'étant ni une lettre, ni un chiffre, ni un espace
            // ! Doit être exécuté après "accentOff", sans quoi les caractères accentués seront supprimés avant d'être remplacés
            const validChars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "+this.searchMode.specialCharsWhiteList;
            let validString="";
            for(const letter of finalString)
            {
                if(validChars.indexOf(letter) !== -1)
                    validString+=letter;
            }
            finalString=validString;
        }
        return finalString;
    }    
    
    public dataIsOk(data: {[index: string]:string}) : boolean
    {
        const realSearch=this.searchPreProcessing(this._inputValue.trim());
        // Pas de valeur saisie = pas de filtre sur ce champ
        if(realSearch.length === 0)
            return true;

        // L'expression saisie doit-elle être séparée en plusieurs "mots" ?
        let searchedWords: string[]=[];
        if(this.searchMode.separatedWords)
            searchedWords=realSearch.split(" ");
        else
            searchedWords[0]=realSearch;

        // Chacun des "mots" doit être trouvé au moins une fois :
        let nbFound=0;
        for(const word of searchedWords)
        {
            for(let field in data)
            {            
                if(this._fields2Search.indexOf(field) !== -1)
                {
                    if(this.searchPreProcessing(data[field]).indexOf(word.trim()) !== -1)
                    {
                        nbFound++;
                        break; // ! sinon, on peut trouver +sieurs fois le même "mot" dans les différents champs.
                    }
                }
            }
        }
        if(nbFound < searchedWords.length) // tous les mots doivent être trouvés
            return false;
        else
            return true;
    }
}
