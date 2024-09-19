import { errors } from './errors';
import { ParseErrors, ParseResults, Parsers, RemoteSources, RemoteSourceSettings } from "./interfaces";
import { RemoteSource } from "./RemoteSource";

export class ParserForHTML implements Parsers
{
    private _datasRemoteSource: RemoteSources;
    private _document2Parse: HTMLDocument=document;
    private _parseResults: ParseResults|undefined=undefined;
    private _fieldsSelector: string="table > thead > tr > th";
    private _rowsSelector: string="table > tbody > tr";
    private _datasSelector: string="tr > td";
    
    constructor(datasRemoteSource?: RemoteSources)
    {
        if(datasRemoteSource !== undefined)
            this._datasRemoteSource=datasRemoteSource;
        else
            this._datasRemoteSource=new RemoteSource({ url:"" });
    }

    public setRemoteSource(source: RemoteSourceSettings)
    {
        this._datasRemoteSource=new RemoteSource(source);
    }

    get datasRemoteSource() : RemoteSources
    {
        return this._datasRemoteSource;
    }

    get document2Parse() : HTMLDocument
    {
        return this._document2Parse;
    }

    set fieldsSelector(selector: string)
    {
        if(selector.trim() === "")
            throw new Error(errors.parserSelectorsIsEmpty);
        else
            this._fieldsSelector=selector.trim();
    }

    get fieldsSelector() : string
    {
         return this._fieldsSelector;
    }
    
    set rowsSelector(selector: string)
    {
        if(selector.trim() === "")
            throw new Error(errors.parserSelectorsIsEmpty);
        else
            this._rowsSelector=selector.trim();
    }

    get datasSelector() : string
    {
         return this._datasSelector;
    }
    
    set datasSelector(selector: string)
    {
        if(selector.trim() === "")
            throw new Error(errors.parserSelectorsIsEmpty);
        else
            this._datasSelector=selector.trim();
    }

    get rowsSelector() : string
    {
         return this._rowsSelector;
    }

    get parseResults() : ParseResults|undefined
    {
        return this._parseResults;
    }

   public async parse():  Promise<any>
   {
        const realFields: string[]=[], datas: {[index: string]:string}[]=[], parseErrors: ParseErrors[]=[];

        // Document HTML distant ?
        if(this._datasRemoteSource.url !== "")
        {
            const settings: {}=this._datasRemoteSource.getFetchSettings();
            const response=await  fetch(this._datasRemoteSource.url, settings);
            if (! response.ok)
                throw new Error(errors.parserRemoteFail);
            const responseHTML=await response.text();
            const parserDOM=new DOMParser();
            this._document2Parse=parserDOM.parseFromString(responseHTML, "text/html");
        }
        
        // Récupération du noms de champs
        const fields=this._document2Parse.querySelectorAll(this._fieldsSelector);
        if(fields.length === 0)
            throw new Error(errors.parserElementsNotFound+this._fieldsSelector);
        for(let i=0; i < fields.length; i++)
        {
            let checkField=(fields[i].textContent+"").trim(); // ajout de "" pour éviter erreur "TS2531: Object is possibly 'null'"
            if(checkField !== "" && realFields.indexOf(checkField) === -1) 
               realFields.push(checkField);
            else
                parseErrors.push({ row:-1, message: errors.parserFieldNameFail});
        }
        if(realFields.length === 0)
            throw new Error(errors.parserFieldsNotFound);
            
        // Puis récupération des éventuelles données.
        const rows=this._document2Parse.querySelectorAll(this._rowsSelector);
        let datasElts;
        for(let i=0;  i < rows.length; i++)
        {
            // Les nombre de données par ligne ne devrait pas être différent du nombre de champs.
            datasElts=rows[i].querySelectorAll(this._datasSelector);
            if(datasElts.length !== realFields.length)
                parseErrors.push({ row:i, message:errors.parserNumberOfFieldsFail});
            // Les chaînes vides sont par contre acceptées ici.
            let dataObject: {[index: string]: string} = {}
            for(let j=0; j < datasElts.length && j < realFields.length; j++)
                dataObject[realFields[j]]=datasElts[j].textContent+"";
            // Mais les lignes complétement vides doivent être ignorées.
           if(Object.keys(dataObject).length !== 0)
                datas.push(dataObject)
            else
                parseErrors.push({ row:i, message: errors.parserLineWithoutDatas});
        }
        this._parseResults =
        {
            datas: datas,
            errors: parseErrors,
            fields: realFields,
        };
   }
}
