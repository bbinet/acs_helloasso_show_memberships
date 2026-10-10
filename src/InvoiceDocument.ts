// Mise en page d'une facture, reprise du modèle template.jinja2 d'acs_helloasso_invoicing,
// sous forme de document pdfmake (transformé en PDF dans le navigateur par InvoicePdf.ts).
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Invoice } from "./InvoiceData.js";
import { euros, frenchDate } from "./format";

export interface Issuer { name: string; title: string; email: string }

export interface InvoiceOptions {
    issuedOn: Date;
    issuer: Issuer;
    signature?: string | null; // image PNG ou JPEG, en data URL
    logo?: string | null; // logo de l'ACS, en SVG
}

const ADDRESS_FROM = [
    "ACS Savoie Technolac",
    "BP 234",
    "16 avenue du lac du Bourget",
    "73370 Le Bourget-du-Lac",
    "N° agrément : W732001354",
    "Email : acs.technolac@gmail.com",
];

// Le logo, très atténué
const watermark = (svg: string) => svg.replace(/(<svg[^>]*>)/, '$1<g opacity="0.05">').replace(/<\/svg>\s*$/, "</g></svg>");

export function invoiceDocument(invoice: Invoice, options: InvoiceOptions): TDocumentDefinitions {
    const recipient = `${invoice.firstName} ${invoice.lastName}`;
    const content: Content[] = [
        options.logo
            ? { columns: [{ svg: options.logo, width: 90 }, { text: ADDRESS_FROM.join("\n"), margin: [20, 0, 0, 0] }] }
            : { text: ADDRESS_FROM.join("\n") },
        {
            text: [`Le Bourget du Lac, le ${frenchDate(options.issuedOn)}`, `A l’attention de ${recipient}`].join("\n"),
            alignment: "right",
            margin: [0, 20, 0, 80],
        },
        { text: `Facture n°${invoice.id}`, margin: [0, 0, 0, 10] },
        { text: [{ text: "Objet : " }, { text: invoice.object }] },
        { text: `Interlocuteur : ${options.issuer.name} – ${options.issuer.email}` },
        {
            margin: [0, 20, 0, 20],
            layout: {
                hLineWidth: (i) => (i > 1 && i < invoice.lines.length + 1 ? 0.5 : 0),
                vLineWidth: () => 0,
                hLineColor: () => "#ddd",
                fillColor: (i) => (i === 0 ? "#eee" : null),
                paddingTop: (i) => (i === invoice.lines.length + 1 ? 15 : 5),
                paddingBottom: () => 5,
            },
            table: {
                headerRows: 1,
                widths: ["*", "auto", "auto", "auto"],
                body: [
                    ["Désignation", "Prix unitaire", "Quantité", "Total"],
                    ...invoice.lines.map((line) => [line.label, euros(line.amount), "1", euros(line.amount)]),
                    [{ text: "Total à payer :", colSpan: 3, alignment: "right" }, "", "", euros(invoice.total)],
                ],
            },
        },
        { text: `Payé le ${frenchDate(invoice.date)}.` },
        {
            stack: [
                { text: [`Etabli par ${options.issuer.name}`, options.issuer.title].join("\n") },
                ...(options.signature ? [{ image: options.signature, width: 140, margin: [0, 5, 0, 0] } as Content] : []),
            ],
            alignment: "right",
            margin: [0, 40, 0, 0],
            unbreakable: true,
        },
    ];
    return {
        info: { title: `ACS − Facture n°${invoice.id} − ${recipient}` },
        pageSize: "A4",
        pageMargins: [56, 56, 56, 56],
        defaultStyle: { fontSize: 10, lineHeight: 1.3, color: "#222" },
        content,
        // Logo en filigrane, en bas à droite de la page
        background: options.logo
            ? { svg: watermark(options.logo), width: 560, absolutePosition: { x: 200, y: 450 } }
            : undefined,
    };
}
