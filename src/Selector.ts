import { compare } from 'natural-orderby';
import { errors } from './errors';
import { DOMElement, Selectors } from "./interfaces";
import { FreeDatas2HTML } from "./FreeDatas2HTML";

export class Selector implements Selectors
{
    private _converter: FreeDatas2HTML;
    private _datasFieldNb: number;
    private _datasViewElt: DOMElement={ id: "", eltDOM: undefined };
    private _selectedValues: number[]=[];
    private _separator: string|undefined;
    private _values: string[]=[];
    private _name: string="";
    public isMultiple: boolean=false;// permet à l'utilisateur de sélectionner plusieurs valeurs dans la liste.

    // Injection de la classe principale, mais uniquement si des données ont été importées.
    // Le champ duquel le sélecteur tire ses données doit exister.
    constructor(converter: FreeDatas2HTML, datasFieldNb: number, elt: DOMElement, separator?: string)
    {
        if(converter.fields.length === 0 || converter.datas.length === 0)
            throw new Error(errors.filterNeedDatas);
        else if(! converter.checkFieldExist(Number(datasFieldNb)))
            throw new Error(errors.selectorFieldNotFound);
        else
        {
            this._datasViewElt=FreeDatas2HTML.checkInDOMById(elt);
            this._converter=converter;
            this._datasFieldNb=datasFieldNb;
            // Pas de trim(), car l'espace peut être le séparateur :
            if(separator !== undefined && separator !== "")
                this._separator=separator;
            this._name=this._converter.fields[this._datasFieldNb];
            this.setValues();
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

    get datasFieldNb() : number
    {
        return this._datasFieldNb;
    }

    get name() : string
    {
        return this._name;
    }
    
    get selectedValues() : number[]
    {
        return this._selectedValues;
    }

    get separator() : string|undefined
    {
        return this._separator;
    }

    get values(): string[]
    {
        return this._values;
    }

    // Dédoublonnage et classement des valeurs disponibles pour le champ du sélecteur
    private setValues() :void
    {
        for (const row of this._converter.datas)
        {
            let checkedValue;
            if(this._separator === undefined)
            {
                checkedValue=row[this._name].trim(); // trim() évite des problèmes de classement des éléments du SELECT.
                if(checkedValue !== "" &&  this._values.indexOf(checkedValue) === -1)
                    this._values.push(checkedValue);
            }
            else
            {
                let checkedValues=row[this._name].split(this._separator);
                for(const value of checkedValues)
                {
                    checkedValue=value.trim();
                    if(checkedValue !== "" &&  this._values.indexOf(checkedValue) === -1)
                        this._values.push(checkedValue);
                }
            }
        }

        if(this._values.length === 0) // possible, si uniquement des valeurs vides pour ce champ.
            throw new Error(errors.selectorFieldIsEmpty);
        else
        {
            // Classement des données à l'aide (ou non) d'une fonction spécifique :
            if(this._converter.getSortingFunctionForField(this._datasFieldNb) !== undefined)
                this._values.sort(this._converter.getSortingFunctionForField(this._datasFieldNb)!.sort); // sans le "!" : TS2532: Object is possibly 'undefined' ???
            else
                this._values.sort(compare());
        }
    }

    // Création du <select> dans le DOM correspondant au filtre
    public filter2HTML(label:string="") : void
    {
        label=(label === "") ? this._name : label;
        const multipleAttr=(this.isMultiple)? " multiple" :"";
        let selectorsHTML="<label for='freeDatas2HTML_"+this._datasViewElt.id+"'>"+label+" :</label><select name='freeDatas2HTML_"+this._datasViewElt.id+"' id='freeDatas2HTML_"+this._datasViewElt.id+"'"+multipleAttr+"><option value='0'>----</option>"; // l'option zéro permet d'actualiser l'affichage en ignorant ce filtre.
        for(let i=0; i< this._values.length; i++)
             selectorsHTML+="<option value='"+(i+1)+"'>"+this._values[i]+"</option>";
        selectorsHTML+="</select>";
        this. _datasViewElt.eltDOM!.innerHTML=selectorsHTML;// "!", car l'existence de "eltDOM" est testé par le constructeur.
        // Actualisation de l'affichage lorsqu'une valeur est sélectionnée :
        const selectElement=document.getElementById("freeDatas2HTML_"+this._datasViewElt.id) as HTMLSelectElement, mySelector=this;
        selectElement.addEventListener("change", function()
       {               
            mySelector._selectedValues=[];
            if(mySelector.isMultiple) 
            {
                for(let i=0; i < selectElement.selectedOptions.length; i++)
                {
                    const selectedValue=parseInt(selectElement.selectedOptions[i].value,10);
                    if(selectedValue === 0) // = annulation de ce filtre
                    {
                        mySelector._selectedValues=[];
                        break;
                    }
                    else
                        mySelector._selectedValues.push(selectedValue-1);
                }
            }
            else
            {
                let selectedValue=parseInt(selectElement.value,10);
                if(selectedValue === 0) // = annulation de ce filtre
                    mySelector._selectedValues=[];
                else
                    mySelector._selectedValues[0]=selectedValue-1;
            }
            mySelector._converter.refreshView();
        });
    }

    public dataIsOk(data: {[index: string]:string}) : boolean
    {
        const checkIsValid=(selector : Selector, data: {[index: string]:string}, checkedValue:string) : boolean =>
        {
            if(selector._separator === undefined)
            {
                if(data[selector._name].trim() !== checkedValue)
                    return false;
                else
                    return true;
            }
            else
            {
                let find=false;
                let checkedValues=data[selector._name].split(selector._separator);
                for(let value of checkedValues)
                {
                    if(value.trim() === checkedValue)
                    {
                        find=true;
                        break;
                    }
                }
                return find;
            }
        };

        // Pas de valeur sélectionnée = pas de filtre sur ce champ, donc tout passe :
        if(this._selectedValues.length === 0)
            return true;

        // Un enregistrement n'ayant pas le champ du filtre sera refusé :
        if(data[this._name] === undefined)
            return false;

        // Si plusieurs options sont sélectionnées dans une liste multiple,
        // il suffit qu'une soit trouvée pour que l'enregistrement soit valide.
        let find=false;
        for(const value of this._selectedValues)
        {
            if(this._values[value] === undefined) // théoriquement impossible, mais cela vient du client...
                throw new Error(errors.selectorSelectedIndexNotFound);
            find=checkIsValid(this, data, this._values[value]);
            if(find)
                break;
        }
        return find;
    }
}
