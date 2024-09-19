import { compare } from 'natural-orderby';
import { errors } from './errors';

import { DatasRenders, DOMElement, Filters, Paginations, Parsers, ParseResults, RemoteSources, SortingFields, SortingFunctions } from "./interfaces";
import { ParserForHTML} from "./ParserForHTML";
import { ParserForJSON} from "./ParserForJSON";
import { Render} from "./Render";

export class FreeDatas2HTML
{
    // Les paramètres de base :
    private _datasViewElt: DOMElement|undefined=undefined;
    public datasRender: DatasRenders;
    public parser: Parsers;
    public stopIfParseErrors: boolean=false;
    
    // Les options (classement, pagination, filtres...) :
    private _datasSortingFunctions: SortingFunctions[]=[];
    public datasFilters: Filters[]=[];
    public datasSortingFields: SortingFields[]=[];
    public datasSortedField: SortingFields|undefined;
    public pagination: Paginations|undefined;
    private _fields2Rend: number[]=[];
    public datasCounterElt: DOMElement|undefined=undefined;
    
    // Les résultats :
    private _fields: ParseResults["fields"]=[];
    private _datas: ParseResults["datas"]=[];
    private _datas2Rend: {[index: string]:string}[]=[];
    private _nbDatasValid: number=0;

    // Le parseur, comme le render sont initialisés.
    // Mais ils peuvent être modifiés ensuite par des instances de classes respectant leurs interfaces.
    constructor(datasFormat:"HTML"|"JSON", datas2Parse="", datasRemoteSource?:RemoteSources)
    {
        this.datasRender=new Render();
        switch (datasFormat)
        {
          case "HTML":
            this.parser=new ParserForHTML();
            break;
          case "JSON":
            this.parser=new ParserForJSON();
            break;
        }
        if(datas2Parse.trim() !== "")
            this.parser.datas2Parse=datas2Parse;
        else if(datasRemoteSource !== undefined)
            this.parser.setRemoteSource(datasRemoteSource);
    }

    // Vérifie s'il y a bien un élément dans le DOM pour l'id fourni.
    // Méthode statique également utilisée par les autres classes.
    public static checkInDOMById(checkedElt: DOMElement) : DOMElement
    {
        let searchEltInDOM=document.getElementById(checkedElt.id);
        if(searchEltInDOM === null)
            throw new Error(errors.converterElementNotFound+checkedElt.id);
        else
        {
            checkedElt.eltDOM=searchEltInDOM;
            return checkedElt;
        }
    }
            
    set datasViewElt(elt: DOMElement)
    {
        this._datasViewElt=FreeDatas2HTML.checkInDOMById(elt);
    }

    get datas(): ParseResults["datas"]
    {
        return this._datas;
    }

    get fields(): ParseResults["fields"]
    {
        return this._fields;
    }

    get nbDatasValid(): number
    {
        return this._nbDatasValid;
    }

    get fields2Rend() : number[]
    {
        return this._fields2Rend;
    }

    get datas2Rend(): {[index: string]:string}[]
    {
        return this._datas2Rend;
    }

    // Retourne l'éventuelle fonction spécifique de classement associée à un champ
    public getSortingFunctionForField(datasFieldNb: number): SortingFunctions|undefined
    {
        for(let checkedFunction of this._datasSortingFunctions)
        {
            if(checkedFunction.datasFieldNb === datasFieldNb)
                return checkedFunction;
        }
        return undefined;
    }
    
    // Lance le parsage des données
    // + lance un premier affichage si l'élément du DOM devant recevoir les données est connu
    public async run():  Promise<any>
    {        
        await this.parser.parse();
        if(this.parser.parseResults ===  undefined) // le parseur devrait lui-même générer une erreur bloquante avant.
            throw new Error(errors.parserFail);
        else
        {
            if(this.stopIfParseErrors && this.parser.parseResults.errors !== undefined)
                throw new Error(errors.parserMeetErrors);
            else
            {
                this._fields=this.parser.parseResults.fields;
                this._datas=this.parser.parseResults.datas;
                if(this._datasViewElt !== undefined)
                    this.refreshView();
                return true;
            }
        }
    }

    // Toutes les méthodes suivantes nécessitent que les données aient d'abord été parsées.

    // Vérifie qu'un champ existe bien dans les données parsées.
    public checkFieldExist(nb: number) : boolean
    {
        if(this.parser.parseResults === undefined || this.parser.parseResults.fields[nb] === undefined)
            return false;
        else
            return true;
    }

    // Vérifie que tous les numéros de champs à afficher sont valides
    // Un tableau vide signifie que tous les champs parsés seront affichés.
    set fields2Rend(fields: number[])
    {
        if(fields.length === 0)
            this._fields2Rend=fields;
        else
        {
            this._fields2Rend=[]; // réinitialisation nécessaire en cas de + sieurs appels au setter
            for(let field of fields)
            {
                if(! this.checkFieldExist(field))
                    throw new Error(errors.converterFieldNotFound);
                else
                    this._fields2Rend.push(field);
            }
        }
    }

    // Vérifie qu'un champ fait partie de ceux à afficher.
    public checkField2Rend(nb: number) : boolean
    {
        if(this._fields2Rend.length === 0)
            return this.checkFieldExist(nb);
        else
        {
            if(this._fields2Rend.indexOf(nb) === -1)
                return false;
            else
                return true;
        }
    }
    
    // Retourne le rang d'un champ parmis ceux à afficher
    public getFieldDisplayRank(nb: number) : number
    {
        if(this.checkField2Rend(nb) ===  false)
            return -1;
        if(this._fields2Rend.length === 0)
            return nb;
        else
            return this._fields2Rend.indexOf(nb);
    }

    // Retourne le nom des champs à afficher
    public realFields2Rend() : string[]
    {
        if(this._fields2Rend.length === 0)
            return this._fields;
        else
        {
            const realFields=[];
            for(const fieldId of this._fields2Rend)
                realFields.push(this._fields[fieldId]);
            return realFields;
        }
    }
    
    // Vérifie que les numéros de champs pour lesquels il y a des fonctions de classement spécifiques sont cohérents.
    set datasSortingFunctions(SortingFunctions: SortingFunctions[])
    {
        this._datasSortingFunctions=[];
        for(let checkedFunction of SortingFunctions)
        {
            if(! this.checkFieldExist(checkedFunction.datasFieldNb))
                throw new Error(errors.converterFieldNotFound);
            else
                this._datasSortingFunctions.push(checkedFunction);
        }
    }

    // Actualise l'affichage des données.
    // Méthode également appelée par les autres classes.
    public refreshView(paginationSelected=false) : void
    {
        if(this._fields.length === 0 || this._datasViewElt === undefined)
            throw new Error(errors.converterRefreshFail);
        else
        {
            if(this._fields2Rend.length === 0)
                this.datasRender.fields=this._fields;
            else
                this.datasRender.fields=this.realFields2Rend();
            
            this._datas2Rend=this.datas2HTML(paginationSelected);
            this.datasRender.datas=this._datas2Rend;
            this._datasViewElt.eltDOM!.innerHTML=this.datasRender.rend2HTML(); // "!", car l'existence de "eltDOM" est testée par le setter.

            // Actualisation du compteur, nécessairement après l'opération précédente,
            // car l'élément HTML du compteur peut être dans le template du Render.
            this.datasCounter2HTML();
                
            // (ré)activation des éventuels liens de classement, s'ils sont affichés en même temps que le reste des données :
            for(let field of this.datasSortingFields)
                field.field2HTML();
            
            // Tout réaffichage peut entraîner une modification du nombre de pages (évolution filtres, etc.)
            // Sauf si la demande de réaffichage vient du choix de la page à afficher
            if(this.pagination !== undefined && !paginationSelected)
                this.pagination.pages2HTML();
        }
    }

    public datasCounter2HTML() : void
    {
        if(this.datasCounterElt !== undefined)
        {
            // La recherche de l'existence de l'élément du compteur du DOM ne se fait pas au niveau d'un setter.
            // Car son emplacement peut être situé dans le template d'affichage des données et donc pas encore affiché.
            // La recherche doit être faite à chaque fois pour cette même raison (bug du DOM).
            this.datasCounterElt=FreeDatas2HTML.checkInDOMById(this.datasCounterElt);
            this.datasCounterElt.eltDOM!.textContent=""+this._nbDatasValid; // "!", car on vient de tester l'existence de l'élément.
        }
    }

    // Fonction sélectionnant les données à afficher en prenant en compte les éventuels filtres, la pagination, etc.
    public datas2HTML(paginationSelected : boolean) : {[index: string]:string}[]
    {
        // Dois-je classer les données par rapport à un champ ?
        if(this.datasSortedField !== undefined)
        {
            const field=this._fields[this.datasSortedField.datasFieldNb];
            const fieldOrder=this.datasSortedField.order;
            // Une fonction spécifique de classement a-t-elle été définie pour ce champ ?
            if(this.getSortingFunctionForField(this.datasSortedField.datasFieldNb) !== undefined)
            {
                const myFunction=this.getSortingFunctionForField(this.datasSortedField.datasFieldNb);
                this._datas.sort( (a, b) => { return myFunction!.sort(a[field], b[field], fieldOrder); });
            }
            else
                this._datas.sort( (a, b) => compare( {order: fieldOrder} )(a[field], b[field]));
        }

        // Dois-je prendre en compte une pagination ?
        let firstData=0;
        if (this.pagination !== undefined && this.pagination.selectedValue !== undefined &&  this.pagination.pages !== undefined && this.pagination.pages.selectedValue !== undefined)
            firstData=this.pagination.selectedValue*(this.pagination.pages.selectedValue-1);
        let maxData=(this.pagination !== undefined && this.pagination.selectedValue !== undefined) ? this.pagination.selectedValue : this._datas.length;

        // Sauf si l'utilisateur vient de choisir la page à afficher, on revient à la première page
        // Car dans les autres cas le nombre d'enregistrements peut avoir évolué et donc le nombre de pages proposées :
        if(this.pagination !== undefined && this.pagination.pages !== undefined && this.pagination.pages.selectedValue !== undefined && !paginationSelected)
             this.pagination.pages.selectedValue=1; // ajouter un test unitaire ?
        
        // Création du tableau des données à afficher :
        let datas2Display=[];
        let nbVisible=0, nbTotal=0;
        for (let row in this._datas)
        {
            // Pour être affichée une ligne doit valider tous les filtres connus
            let valid=true, i=0;
            while(this.datasFilters[i] !== undefined && valid === true)
            {
                valid=this.datasFilters[i].dataIsOk(this._datas[row]);
                i++;
            }
            if(valid && nbTotal >= firstData && nbVisible < maxData)
            {
                datas2Display.push(this._datas[row]);
                nbVisible++;
                nbTotal++;
            }
            else if(valid)
                nbTotal++;
        }
        this._nbDatasValid=nbTotal;

        // Tous les champs doivent-ils être affichés ?
        // Ne pas les enlever les champs + tôt, car ils peuvent servir à filtrer les données
        if(this._fields2Rend.length !== 0)
        {
            const realFields=this.realFields2Rend(), newDatas2Display=[];
            for(let row in datas2Display)
            {
                let newData: {[index: string]: string}={};
                for(let field in datas2Display[row])
                {
                    if(realFields.indexOf(field) !== -1)
                        newData[field]=datas2Display[row][field];
                }
                newDatas2Display.push(newData);
            }
            datas2Display=newDatas2Display;
        }
        return datas2Display;
    }
}

// Permet l'appel des principales classes du module via un seul script :
export { Pagination } from "./Pagination";
export { Render} from "./Render"; 
export { SearchEngine } from "./SearchEngine"; 
export { Selector } from "./Selector"; 
export { SortingField } from "./SortingField"; 
