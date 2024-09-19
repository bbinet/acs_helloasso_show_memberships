import { errors } from './errors';
import { RemoteSource } from "./RemoteSource";
import { ParseErrors, ParseResults, Parsers, RemoteSources, RemoteSourceSettings } from "./interfaces";

export class ParserForJSON implements Parsers
{
    private _datasRemoteSource: RemoteSources;
    private _datas2Parse: string="";
    private _parseResults: ParseResults|undefined=undefined;

    // L'instance d'une autre classe que RemoteSource peut être passée au constructeur
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

    set datas2Parse(datas: string)
    {
        if(datas.trim().length === 0)
            throw new Error(errors.parserNeedDatas);
        else
            this._datas2Parse=datas.trim();
    }

    get datas2Parse() : string
    {
        return this._datas2Parse;
    }

    get parseResults() : ParseResults|undefined
    {
        return this._parseResults;
    }

   public async parse():  Promise<any>
   {
        const parser=this;
        let parseContent=""; 
        if(parser._datasRemoteSource.url !== "")
        {
            const settings: {}=parser._datasRemoteSource.getFetchSettings();
            const response=await  fetch(parser._datasRemoteSource.url, settings);
            if (! response.ok)
                throw new Error(errors.parserRemoteFail);
            parseContent=await response.text(); // doit en fait retourner du JSON, mais il est parsé plus loin.
        }
        else if(parser._datas2Parse !== "")
            parseContent=parser._datas2Parse;
        else
            throw new Error(errors.parserNeedSource);

        const datasParsed=JSON.parse(parseContent);
        const typesOkForValue=["boolean","number","string"];
        let fields: string[]=[], datas: {[index: string]:string}[]=[], parseErrors: ParseErrors[]=[];
        // Je peux recevoir 2 tableaux contenant respectivement la liste de champs : string[] + celle des données : any[][]
        if(Array.isArray(datasParsed.fields) &&  Array.isArray(datasParsed.datas))
        {
            const nbFields=datasParsed.fields.length, nbDatas=datasParsed.datas.length;
            // Traitement des noms de champs reçus :
            const goodFields: string[]=[];
            fields=datasParsed.fields;
            for(let i=0; i < nbFields; i++)
            {
                if(typeof fields[i] !== "string")
                    parseErrors.push({ row:-1, message: errors.parserTypeError+typeof fields[i] });
                else
                {
                    fields[i]=fields[i].trim();
                    if(fields[i] !== "" && goodFields.indexOf(fields[i]) === -1)
                        goodFields.push(fields[i]);
                    else
                        parseErrors.push({ row:-1, message: errors.parserFieldNameFail});
                }
            }
            fields=goodFields;
            if(fields.length === 0)
                throw new Error(errors.parserFail);
            // Puis les données :
            for(let i=0; i < nbDatas; i++)
            {
                const dataObject: {[index: string]: string}={}, nbObjFields=datasParsed.datas[i].length;
                if( nbObjFields !== nbFields)
                    parseErrors.push({ row:i, message:errors.parserNumberOfFieldsFail});
                for(let j=0; j < nbObjFields && j < nbFields; j++)
                {
                    if(typesOkForValue.indexOf(typeof datasParsed.datas[i][j]) === -1)
                        parseErrors.push({ row:i, message:errors.parserTypeError+typeof datasParsed.datas[i][j]});
                    else
                         dataObject[fields[j]]=datasParsed.datas[i][j]+""; // force le type String
                }
                if(Object.keys(dataObject).length !== 0)
                    datas.push(dataObject);
                else
                    parseErrors.push({ row:i, message: errors.parserLineWithoutDatas});
            }
        }
        else // Ou un tableau d'objets {}[], dont les attributs sont les noms des champs
        {
            let i=0;
            for(let data of datasParsed)
            {
                // Ici les champs sont découverts au fur et à mesure,
                // Leur ordre peut être différent d'une ligne à l'autre
                // Et tous les champs ne sont pas systématiquement présents
                let dataObject: {[index: string]: string} = {}
                for(let field in data)
                {
                    field=field.trim();
                    if(field === "")
                        parseErrors.push({ row:-1, message: errors.parserFieldNameFail});
                    else if (typesOkForValue.indexOf(typeof data[field]) === -1)
                        parseErrors.push({ row:i, message:errors.parserTypeError+typeof data[field]});
                    else
                    {
                        if(fields.indexOf(field) === -1)
                            fields.push(field);
                        if(dataObject[field] !== undefined) // = doublon
                            parseErrors.push({ row:i, message:errors.parserFieldNameFail});
                        else
                            dataObject[field]=data[field]+""; // force le type String
                    }
                }
                if(Object.keys(dataObject).length !== 0)
                    datas.push(dataObject);
                else
                    parseErrors.push({ row:i, message: errors.parserLineWithoutDatas});
                i++;
            }
            if(fields.length === 0)
                throw new Error(errors.parserFail);            
        }
        parser._parseResults =
        {
            datas: datas,
            errors: parseErrors,
            fields: fields,
        };
   }
}
