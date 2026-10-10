// Mise en forme commune aux pages, aux factures et aux exports

// Texte inséré dans du HTML
export const escape = (text: unknown) => String(text ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// 1234.5 => "1 234,50 €", avec des espaces insécables : le nombre et le « € » ne sont jamais coupés en fin de ligne
export const euros = (amount: number) =>
    `${amount.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+,)/g, " ")} €`;

// 09/10/2026, en heure de Paris (une date « AAAA-MM-JJ » seule est prise telle quelle)
export const frenchDate = (date: Date | string) =>
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date.split("-").reverse().join("/")
        : new Date(date).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });

// 17h28, en heure de Paris
export const parisTime = (date: Date) =>
    date.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).replace(":", "h");
