// Transforme une facture en PDF dans le navigateur (pdfmake), avec le logo de l'ACS.
// pdfmake et ses polices (2 Mo) sont chargés depuis jsDelivr plutôt qu'intégrés à la page chiffrée :
// l'empreinte « integrity » garantit que le fichier reçu est exactement celui de cette version.
import type { TCreatedPdf } from "pdfmake/build/pdfmake";
import logo from "./assets/logo.svg?raw";
import { invoiceDocument, type Issuer } from "./InvoiceDocument";
import type { Invoice } from "./InvoiceData.js";
import { loadScript } from "./loadScript";

const PDFMAKE = "https://cdn.jsdelivr.net/npm/pdfmake@0.3.11/build/";
const SCRIPTS = [
    { src: `${PDFMAKE}pdfmake.min.js`, integrity: "sha384-vsaIaEjAOZA6uoCQ2pryCKIc8YGpQ/0HK5krdezL4PYvnmLzrizBMDJCZulvIomS" },
    // Les polices s'enregistrent d'elles-mêmes dans pdfmake : à charger après lui
    { src: `${PDFMAKE}vfs_fonts.js`, integrity: "sha384-pkBUW1wxcm6m7ZjKDxADnNHqnz+Sx9sAL1ndsLNv/GZnWZgodPYsju1yxeyQnn0c" },
];

// Les scripts ne sont chargés qu'une fois (voir loadScript)
export const loadPdfMake = async (): Promise<typeof import("pdfmake/build/pdfmake")> => {
    for (const script of SCRIPTS)
        await loadScript(script);
    return (window as any).pdfMake;
};

export interface InvoiceSettings { issuer: Issuer; signature: string | null }

export const invoiceFileName = (invoice: Invoice) => `Facture-ACS-${invoice.id}.pdf`;

export const invoicePdf = async (invoice: Invoice, settings: InvoiceSettings): Promise<TCreatedPdf> =>
    (await loadPdfMake()).createPdf(invoiceDocument(invoice, { issuedOn: new Date(), logo, ...settings }));
