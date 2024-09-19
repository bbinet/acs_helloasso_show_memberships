export interface DatasRenders
{
    fields: string[];
    datas: {[index: string]:string}[];
    rend2HTML(): string;
}
export interface DatasRendersSettings // interface spécifique à la classe Render par défaut
{
    allBegining: string;
    allEnding: string;
    fieldsBegining?: string;
    fieldsEnding?: string;
    fieldDisplaying?: string;
    linesBegining: string;
    linesEnding: string;
    lineBegining: string;
    lineEnding: string;
    dataDisplaying: string;
}
export interface DOMElement
{
    id: string;
    eltDOM?: HTMLElement;
}
export interface Filters
{
    datasViewElt: DOMElement;
    filter2HTML() : void;
    dataIsOk(data: {[index: string]:string}) : boolean;
}
export interface Paginations
{
    options?: PaginationsOptions;
    selectedValue: number|undefined;
    pages: PaginationsPages;
    options2HTML(): void;
    pages2HTML() : void;
}
export interface PaginationsOptions
{
    displayElement: DOMElement;
    name?: string;
    values: number[];
};
export interface PaginationsPages
{
    displayElement: DOMElement;
    name?: string; 
    values?: number[];
    selectedValue?: number;
}
export interface ParseErrors
{
	code?: string;
	message: string;
	row: number; // -1 quand bug avant de traiter les lignes
    type?: string;
}
export interface ParseResults
{
    datas: {[index: string]:string}[];
    errors:  ParseErrors[];
    fields: string[];
}
export interface Parsers
{
    datasRemoteSource: RemoteSources;
    setRemoteSource(settings : RemoteSourceSettings): void;
    datas2Parse?: string;
    document2Parse?: HTMLDocument; 
    parseResults: ParseResults|undefined;
    parse(): Promise<void>;
}
export interface RemoteSourceSettings
{
    url: string;
    headers?: { key:string, value:string }[];
    withCredentials?: boolean;
}
export interface RemoteSources extends RemoteSourceSettings
{
    getFetchSettings() : {};
}
export interface SearchModeSettings
{
    accentOff: boolean;
    caseOff: boolean;
    separatedWords: boolean;
    specialCharsOff: boolean;
    specialCharsWhiteList: string;
}
export interface Selectors extends Filters
{
    datasFieldNb: number;
    name: string;
    selectedValues: number[];
    separator: string|undefined;
    values: string[];
}
export interface SortingFields
{
    datasFieldNb: number;
    order: "asc"|"desc"|undefined;
    field2HTML() : void;
}
export interface SortingFunctions
{
  datasFieldNb: number;
  sort(a: any,b: any, order?: "asc"|"desc"): number; // cf. https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
}