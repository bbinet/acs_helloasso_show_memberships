// Copie des adresses email dans le presse-papiers, au format « "Prénom Nom" <email>, ... », à coller dans le champ
// « Cci » d'un mail : factures sélectionnées (page admin) ou résultats de la liste des adhérents
import { emailList, uniqueByEmail, type Contact } from "./Export";

export async function copyEmails(contacts: Contact[], message: HTMLElement) {
    const emails = emailList(contacts);
    try {
        await navigator.clipboard.writeText(emails);
        message.textContent = `${uniqueByEmail(contacts).length} adresse(s) copiée(s) : à coller dans le champ « Cci » d'un mail.`;
    } catch {
        // Presse-papiers refusé par le navigateur : adresses affichées pour un copier-coller à la main
        prompt("Copier les adresses :", emails);
    }
}
