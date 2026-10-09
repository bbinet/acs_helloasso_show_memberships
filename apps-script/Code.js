// Envoi des factures ACS par email, appelé par la page d'administration du site (admin/).
// Script Google Apps Script du compte acs.tresorier@gmail.com, qui tient le registre des envois dans une feuille :
// voir apps-script/README.md pour l'installation. Paramètres dans les propriétés du script.

// Point d'entrée de l'application web : la page envoie un POST dont le corps est du JSON
function doPost(e) {
    let result;
    try {
        result = handleRequest_(JSON.parse(e.postData.contents));
    } catch (error) {
        result = { ok: false, error: String(error.message || error) };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// Un onglet par saison : « Factures 2026-2027 »
const SHEET_PREFIX = "Factures ";
const HEADERS = ["N° facture", "Nom", "Email", "Date", "Statut", "Détail"];
const DEFAULT_SUBJECT = "Facture adhésion ACS";
const DEFAULT_BODY = "Bonjour,\n\nVeuillez trouver ci-joint la facture de votre adhésion à l'ACS.\n\nBien cordialement,\nLe trésorier de l'ACS";

function handleRequest_(request) {
    if (!request.token || request.token !== property_("TOKEN"))
        return { ok: false, error: "Accès refusé" };
    // Saison « 2026-2027 » (ou « 2026/2027 ») : nom de l'onglet et du dossier Drive de la saison
    const season = String(request.season || "").replace("/", "-");
    if (!/^\d{4}-\d{4}$/.test(season))
        return { ok: false, error: "Saison invalide" };
    request.season = season;
    if (request.action === "status")
        return { ok: true, invoices: readRegistry_(request.season) };
    if (request.action === "send") {
        // Un seul envoi à la fois : deux personnes du bureau ne peuvent pas envoyer la même facture en même temps
        const lock = LockService.getScriptLock();
        lock.waitLock(30000);
        try {
            return sendInvoice_(request);
        } finally {
            lock.releaseLock();
        }
    }
    return { ok: false, error: "Action inconnue" };
}

// Envoie la facture (PDF généré par la page) au payeur de l'adhésion, tel que connu de HelloAsso :
// l'adresse email n'est jamais prise dans la demande.
function sendInvoice_(request) {
    const id = Number(request.id);
    const season = request.season;
    const previous = readRegistry_(season)[String(id)];
    if (previous && previous.status === "envoyée" && !request.resend)
        return { ok: false, error: "Facture n°" + id + " déjà envoyée", status: previous };
    const item = helloAssoItem_(id);
    if (String(item.order.formType).toLowerCase() !== "membership")
        return { ok: false, error: "N°" + id + " : pas une adhésion" };
    if (item.payments && item.payments.some(function (p) { return (p.refundOperations || []).length > 0; }))
        return { ok: false, error: "Adhésion n°" + id + " remboursée" };
    const name = item.user.firstName + " " + item.user.lastName;
    const email = item.payer.email;
    const blob = Utilities.newBlob(Utilities.base64Decode(request.pdf), "application/pdf", "Facture-ACS-" + id + ".pdf");
    if (MailApp.getRemainingDailyQuota() < 1)
        return { ok: false, quota: true, error: "Quota d'envoi quotidien de Gmail atteint : reprendre l'envoi demain" };
    try {
        // L'objet contient le n° de facture : il permet de retrouver la facture dans les mails d'erreur (voir checkBounces)
        GmailApp.sendEmail(email, (property_("MAIL_SUBJECT") || DEFAULT_SUBJECT) + " n°" + id,
            (property_("MAIL_BODY") || DEFAULT_BODY).replace(/\\n/g, "\n"),
            { attachments: [blob], name: property_("MAIL_NAME") || "ACS Savoie Technolac" });
    } catch (error) {
        const detail = String(error.message || error);
        return { ok: false, error: detail, status: record_(season, id, { name: name, email: email, status: "erreur", detail: detail }) };
    }
    // Archive des factures envoyées, pour la comptabilité : un sous-dossier par saison (« 2026-2027 »)
    if (property_("DRIVE_FOLDER_ID"))
        seasonFolder_(season).createFile(blob);
    return { ok: true, status: record_(season, id, { name: name, email: email, status: "envoyée", detail: "" }) };
}

function seasonFolder_(season) {
    const parent = DriveApp.getFolderById(property_("DRIVE_FOLDER_ID"));
    const folders = parent.getFoldersByName(season);
    return folders.hasNext() ? folders.next() : parent.createFolder(season);
}

// Adhésion HelloAsso, avec le payeur
function helloAssoItem_(id) {
    const api = property_("HELLOASSO_API") || "https://api.helloasso.com";
    const auth = JSON.parse(UrlFetchApp.fetch(api + "/oauth2/token", {
        method: "post",
        payload: { grant_type: "client_credentials", client_id: property_("HELLOASSO_ID"), client_secret: property_("HELLOASSO_SECRET") },
    }).getContentText());
    const response = UrlFetchApp.fetch(api + "/v5/items/" + id + "?withDetails=true", {
        headers: { Authorization: "Bearer " + auth.access_token },
        muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200)
        throw new Error("Adhésion n°" + id + " introuvable sur HelloAsso");
    return JSON.parse(response.getContentText());
}

// À lancer une fois depuis l'éditeur Apps Script : vérifie les mails d'erreur chaque jour vers 7h
function installTrigger() {
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
        if (trigger.getHandlerFunction() === "checkBounces")
            ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger("checkBounces").timeBased().everyDays(1).atHour(7).create();
}

// Mails d'erreur (adresse introuvable, boîte pleine...) reçus après l'envoi d'une facture.
// Lancé chaque jour par un déclencheur (voir installTrigger) : la facture passe en « non distribuée ».
// Seuls comptent les mails d'erreur arrivés après le dernier envoi de la facture : un renvoi repart de zéro.
function checkBounces() {
    // Factures de toutes les saisons : les n° HelloAsso sont uniques
    const invoices = {};
    spreadsheet_().getSheets().forEach(function (sheet) {
        const name = sheet.getName();
        if (name.indexOf(SHEET_PREFIX) !== 0)
            return;
        const season = name.slice(SHEET_PREFIX.length);
        const registry = readRegistry_(season);
        Object.keys(registry).forEach(function (id) {
            invoices[id] = registry[id];
            invoices[id].season = season;
        });
    });
    GmailApp.search("from:(mailer-daemon OR postmaster) newer_than:30d").forEach(function (thread) {
        const messages = thread.getMessages();
        // Gmail range le mail d'erreur dans la conversation du mail envoyé : le n° de facture est dans l'objet
        const id = invoiceNumber_(messages);
        const entry = id && invoices[id];
        if (!entry || entry.status !== "envoyée")
            return;
        const bounce = messages.filter(function (message) {
            return isBounce_(message) && message.getDate().getTime() > new Date(entry.date).getTime();
        })[0];
        if (bounce)
            record_(entry.season, id, { name: entry.name, email: entry.email, status: "non distribuée", detail: bounceReason_(bounce.getPlainBody()) });
    });
}

// Mail d'erreur définitif : pas un simple retard, que le serveur va retenter
function isBounce_(message) {
    return /mailer-daemon|postmaster/i.test(message.getFrom())
        && !/delay|retard|not (been )?delivered yet|pas encore/i.test(message.getSubject() + "\n" + message.getPlainBody());
}

function invoiceNumber_(messages) {
    for (let i = 0; i < messages.length; i++) {
        const match = (messages[i].getSubject() + "\n" + messages[i].getPlainBody()).match(/Facture[^\n]*n°\s*(\d+)/);
        if (match)
            return match[1];
    }
    return null;
}

// La phrase qui explique l'erreur, sinon le titre du mail d'erreur (« ** Address not found ** »)
function bounceReason_(body) {
    const lines = body.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    const sentence = lines.filter(function (line) { return /delivered to|envoyé à|distribué à/i.test(line); })[0];
    return (sentence || lines[0] || "Mail non distribué").slice(0, 300);
}

// Registre des envois d'une saison : l'onglet « Factures 2026-2027 », une ligne par facture, créé au besoin
function registrySheet_(season) {
    const spreadsheet = spreadsheet_();
    const name = SHEET_PREFIX + season;
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
        sheet = spreadsheet.insertSheet(name);
        sheet.appendRow(HEADERS);
    }
    return sheet;
}

function readRegistry_(season) {
    const invoices = {};
    registrySheet_(season).getDataRange().getValues().slice(1).forEach(function (row) {
        invoices[String(row[0])] = { name: row[1], email: row[2], date: new Date(row[3]).toISOString(), status: row[4], detail: row[5] };
    });
    return invoices;
}

// Ajoute ou met à jour la ligne de la facture
function record_(season, id, entry) {
    const sheet = registrySheet_(season);
    const row = [id, entry.name, entry.email, new Date(), entry.status, entry.detail];
    const index = sheet.getDataRange().getValues().findIndex(function (r) { return String(r[0]) === String(id); });
    if (index > 0)
        sheet.getRange(index + 1, 1, 1, row.length).setValues([row]);
    else
        sheet.appendRow(row);
    return readRegistry_(season)[String(id)];
}

// La feuille du registre : celle désignée par la propriété SHEET_ID (script autonome, créé sur
// script.google.com), sinon celle à laquelle le script est rattaché
function spreadsheet_() {
    const id = property_("SHEET_ID");
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function property_(key) {
    return PropertiesService.getScriptProperties().getProperty(key);
}
