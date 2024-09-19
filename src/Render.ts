import { errors } from './errors';
import {  DatasRenders, DatasRendersSettings } from "./interfaces";

export class Render implements DatasRenders
{
    private _fields: string[]=[];
    public settings: DatasRendersSettings;
    public datas: {[index: string]:string}[]=[];
    static readonly defaultSettings= 
    {
        allBegining: "<table>",
        allEnding: "</table>",
        fieldsBegining: "<thead><tr>",
        fieldsEnding: "</tr></thead>",
        fieldDisplaying: "<th>#FIELDNAME</th>",
        linesBegining: "<tbody>",
        linesEnding: "</tbody>",
        lineBegining: "<tr>",
        lineEnding: "</tr>",
        dataDisplaying: "<td>#VALUE</td>"
    };

    constructor(settings: DatasRendersSettings=Render.defaultSettings)
    {
        this.settings=settings;
    }

    // Les données fournies peuvent être vides du fait de l'action des filtres ou encore de la pagination...
    // Par contre, il doit y avoir au moins un nom de champ fourni
    set fields(fields: string[])
    {
        if(fields.length === 0)
            throw new Error(errors.renderNeedFields);
        else
            this._fields=fields;
    }

    get fields() : string[]
    {
        return this._fields;
    }
    
    public rend2HTML() : string
    {
        if(this._fields.length === 0)
            throw new Error(errors.renderNeedFields);
        else
        {
            let datasHTML=this.settings.allBegining;
            // Les noms des champs ne sont pas forcément affichés séparément.
            if(this.settings.fieldsBegining !== undefined && this.settings.fieldDisplaying !== undefined && this.settings.fieldsEnding !== undefined )
            {
                datasHTML+=this.settings.fieldsBegining;
                for(let field of this._fields)
                    datasHTML+=this.settings.fieldDisplaying.replace("#FIELDNAME", field);
                datasHTML+=this.settings.fieldsEnding;
            }
            datasHTML+=this.settings.linesBegining;
            
            // Suivant les objets/lignes, les champs peuvent se trouver dans un ordre différent.
            // Ou encore des champs peuvent manquer, être en trop...
            // Tous les champs présents dans "fields" doivent être affichés (même si absents d'un enregistrement) et en respectant l'ordre de ce tableau.
            for(let row of this.datas)
            {
                datasHTML+=this.settings.lineBegining;
                for(let field of this._fields)
                {
                    if(row[field] !== undefined)
                        datasHTML+=this.settings.dataDisplaying.replace("#VALUE", row[field]).replace("#FIELDNAME", field);
                    else
                        datasHTML+=this.settings.dataDisplaying.replace("#VALUE", "").replace("#FIELDNAME", field);
                }
                datasHTML+=this.settings.lineEnding;
            }
            datasHTML+=this.settings.linesEnding+this.settings.allEnding;
            return datasHTML;
        }
    }
}
