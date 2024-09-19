import { errors } from './errors';

import { RemoteSources,  RemoteSourceSettings } from "./interfaces";

export class RemoteSource implements RemoteSources
{
    public allowedUrlProtocol: string[]=["https:","http:"];
    private _url: string="";
    private _headers: { key:string, value:string }[]=[];
    private _withCredentials: boolean=false;

    constructor(RemoteSettings: RemoteSourceSettings)
    {
        // Le fait de ne pas utiliser le préfixe _ implique de passer par les setters
        // Mais l'url n'est testée que si elle n'est pas vide.
        if(RemoteSettings.url !== "")
            this.url=RemoteSettings.url;
        if(RemoteSettings.headers !== undefined)
            this.headers=RemoteSettings.headers;
        if(RemoteSettings.withCredentials !== undefined)
            this.withCredentials=RemoteSettings.withCredentials;
    }
            
    set url(url: string)
    {
        if(url.trim().length === 0)
            throw new Error(errors.remoteSourceNeedUrl);
        else
        {
            try
            {
                const checkUrl=new URL(url);// peut générer une erreur si url bidon
                if(this.allowedUrlProtocol.indexOf(checkUrl.protocol) === -1)
                    throw new Error();
            }
            catch(e)
            {
                console.error(e);
                throw new Error(errors.remoteSourceUrlFail);
            }
            this._url=url.trim();
        }
    }

    get url() : string
    {
        return this._url;
    }

    set headers(headers: { key:string, value:string }[])
    {
        // cf. https://developer.mozilla.org/fr/docs/Glossary/Forbidden_header_name
        const forbiddenHeadersNames: string[]=["Accept-Charset","Accept-Encoding","Access-Control-Request-Headers","Access-Control-Request-Method","Connection","Content-Length","Cookie","Cookie2","Date","DNT","Expect","Host","Keep-Alive","Origin","Referer","TE","Trailer","Transfer-Encoding","Upgrade","Via"]; 
        for(let header of headers)
        {
            header.key=header.key.trim();
            if(header.key.startsWith("Sec-") || header.key.startsWith("Proxy-") || forbiddenHeadersNames.indexOf(header.key) !== -1)
                console.error(errors.remoteSourceHeaderIsUnallowed);
            else
                this._headers.push({ key:header.key, value:header.value.trim() });
        }
    }

    get headers() : { key:string, value:string }[]
    {
        return this._headers;
    }

    set withCredentials(credentials: boolean)
    {
        this._withCredentials=credentials;
    }

    get withCredentials() : boolean
    {
        return this._withCredentials;
    }

    public getFetchSettings() : {}
    {
        const headers=new Headers();            
        if(this._headers !== undefined)
        {
            for(let header of this._headers)
                headers.append(header.key, header.value);
        }
        const credentials: RequestCredentials|undefined=(this._withCredentials) ? "include" : "omit";
        return { method:"GET", headers:headers, credentials:credentials };
    }
}
