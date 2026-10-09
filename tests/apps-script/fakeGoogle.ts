// Faux services Google Apps Script et faux HelloAsso, pour exécuter apps-script/Code.js sous Node
// comme Apps Script le fait : le fichier est chargé tel quel, les services sont des variables globales.
import { readFileSync } from "fs";
import vm from "vm";

export interface SentMail { to: string; subject: string; body: string; options: any }
export interface Mail { from: string; subject: string; body: string; date?: Date }

export function fakeEnvironment(items: Record<number, any>) {
    const properties: Record<string, string> = {
        TOKEN: "jeton-secret",
        HELLOASSO_API: "https://api.helloasso.com",
        HELLOASSO_ID: "id",
        HELLOASSO_SECRET: "secret",
    };
    const sheets: Record<string, any[][]> = {};
    const sent: SentMail[] = [];
    const inbox: { messages: Mail[] }[] = [];
    const drive: Record<string, string[]> = {};
    const env = { properties, sheets, sent, inbox, drive, quota: 100, gmailError: null as string | null, openedById: false };

    const sheet = (name: string) => ({
        getDataRange: () => ({ getValues: () => sheets[name].map((row) => [...row]) }),
        appendRow: (row: any[]) => { sheets[name].push([...row]); },
        getRange: (row: number, column: number, rows: number, columns: number) => ({
            setValues: (values: any[][]) => {
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < columns; c++)
                        sheets[name][row - 1 + r][column - 1 + c] = values[r][c];
            },
        }),
    });

    // Dossiers Drive repérés par leur chemin : drive["dossier/sous-dossier"] = noms des fichiers
    const folder = (path: string): any => {
        drive[path] ??= [];
        return {
            createFile: (blob: { name: string }) => { drive[path].push(blob.name); },
            getFoldersByName: (name: string) => {
                const found = drive[`${path}/${name}`] ? [folder(`${path}/${name}`)] : [];
                return { hasNext: () => found.length > 0, next: () => found.shift() };
            },
            createFolder: (name: string) => {
                if (drive[`${path}/${name}`])
                    throw new Error(`Dossier ${name} en double`);
                return folder(`${path}/${name}`);
            },
        };
    };

    const response = (code: number, body: unknown) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });

    const globals: any = {
        PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties[key] ?? null }) },
        SpreadsheetApp: {
            // Script autonome : la feuille est ouverte par son identifiant (propriété SHEET_ID)
            openById: (id: string) => {
                if (id !== "id-de-la-feuille")
                    throw new Error(`Feuille ${id} introuvable`);
                env.openedById = true;
                return globals.SpreadsheetApp.getActiveSpreadsheet();
            },
            getActiveSpreadsheet: () => ({
                getSheetByName: (name: string) => (sheets[name] ? sheet(name) : null),
                insertSheet: (name: string) => { sheets[name] = []; return sheet(name); },
                getSheets: () => Object.keys(sheets).map((name) => ({ ...sheet(name), getName: () => name })),
            }),
        },
        LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
        ContentService: {
            MimeType: { JSON: "JSON" },
            createTextOutput: (content: string) => ({ getContent: () => content, setMimeType() { return this; } }),
        },
        Utilities: {
            base64Decode: (data: string) => [...Buffer.from(data, "base64")],
            newBlob: (bytes: number[], contentType: string, name: string) => ({ bytes, contentType, name, getName: () => name }),
        },
        UrlFetchApp: {
            fetch: (url: string, _options?: any) => {
                if (url === "https://api.helloasso.com/oauth2/token")
                    return response(200, { access_token: "acces-helloasso" });
                const match = url.match(/^https:\/\/api\.helloasso\.com\/v5\/items\/(\d+)\?withDetails=true$/);
                if (match && items[+match[1]])
                    return response(200, items[+match[1]]);
                return response(404, { message: "Not found" });
            },
        },
        DriveApp: { getFolderById: (id: string) => folder(id) },
        MailApp: { getRemainingDailyQuota: () => env.quota },
        GmailApp: {
            sendEmail: (to: string, subject: string, body: string, options: any) => {
                if (env.gmailError)
                    throw new Error(env.gmailError);
                sent.push({ to, subject, body, options });
            },
            search: (_query: string) => inbox.map((thread) => ({
                getMessages: () => thread.messages.map((m) => ({
                    getFrom: () => m.from, getSubject: () => m.subject, getPlainBody: () => m.body, getDate: () => m.date ?? new Date(),
                })),
            })),
        },
    };

    const script = vm.createContext({ ...globals, console, Date });
    vm.runInContext(readFileSync(new URL("../../apps-script/Code.js", import.meta.url), "utf8"), script);

    // Appel de l'application web, comme le fait la page admin (POST, corps JSON)
    const post = (body: object) => JSON.parse(script.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());

    return { env, script, post };
}
