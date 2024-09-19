import { errors } from './errors';
import { SortingFields } from "./interfaces";
import { FreeDatas2HTML } from "./FreeDatas2HTML";

export class SortingField implements SortingFields
{
    _converter: FreeDatas2HTML;
    _fieldsDOMSelector: string; 
    _datasFieldNb: number;
    _order: "asc"|"desc"|undefined=undefined;

    // Injection de la classe principale, mais uniquement si les noms des champs ont été importés.
    // Et le numéro de champ doit être trouvé parmis ceux devant être affichés.
    constructor(converter: FreeDatas2HTML, datasFieldNb: number, fieldsDOMSelector: string="th")
    {
        if(converter.fields.length === 0)
            throw new Error(errors.sortingFieldNeedDatas);
        else if(! converter.checkField2Rend(datasFieldNb))
            throw new Error(errors.sortingFieldNotFound);
        else
        {
            this._converter=converter;
            this._datasFieldNb=datasFieldNb;
            this._fieldsDOMSelector=fieldsDOMSelector;
        }
    }

    get converter() : FreeDatas2HTML
    {
        return this._converter;
    }

    get datasFieldNb() : number
    {
        return this._datasFieldNb;
    }
    
    get fieldsDOMSelector() : string
    {
        return this._fieldsDOMSelector;
    }
        
    set order(setting :"asc"|"desc"|undefined ) 
    {
        this._order=setting;
    }

    get order() : "asc"|"desc"|undefined
    {
        return this._order;
    }
    
    public field2HTML() : void
    {
        const  fields=document.querySelectorAll(this.fieldsDOMSelector);
        if(fields === undefined)
            throw new Error(errors.sortingFieldsNotInHTML);
        else if(fields.length !== this._converter.realFields2Rend().length)
            throw new Error(errors.sortingFieldsNbFail);
        else
        {
            // Arrivé ici l'existence de l'élément a été vérifiée, mais c'est sa position qui permet de le cibler :
            let htmlContent;
            const index=this._converter.getFieldDisplayRank(this._datasFieldNb);
            htmlContent=fields[index].innerHTML;
            htmlContent="<a href='#freeDatas2HTMLSorting"+this._datasFieldNb+"' id='freeDatas2HTMLSorting"+this._datasFieldNb+"'>"+htmlContent+"</a>";
            fields[index].innerHTML=htmlContent;
            const sortingElement=document.getElementById("freeDatas2HTMLSorting"+this._datasFieldNb), field=this;
            sortingElement!.addEventListener("click", function(e) // "!" car je sais que sortingElement existe, puisque je viens de le créer !
            {
                e.preventDefault();
                let order=field._order ;
                if(order === undefined || order === "desc")
                    field._order="asc";
                else
                    field._order="desc";
                field._converter.datasSortedField=field;
                field._converter.refreshView();
            });
        }
    }
}
