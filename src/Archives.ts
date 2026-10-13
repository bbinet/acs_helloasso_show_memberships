// Données des saisons archivées (voir archives.sh) : téléchargées seulement quand la page admin en a besoin
// (statistiques, listes des adhérents des saisons précédentes), une seule fois, puis déchiffrées avec la clé
// placée dans la page admin à sa construction (dérivée du mot de passe admin, voir buildadmin.js).
import { decryptArchive } from "./ArchiveCrypto.js";
import type { Member } from "./Stats";

export interface Archive {
    fields: string[];
    // De la plus récente à la plus ancienne
    seasons: { season: string; members: string[][]; summaries: Member[] }[];
}

let loading: Promise<Archive> | null = null;

const fetchArchive = async (): Promise<Archive> => {
    // Serveur de développement, sans clé : données en clair de acs-archives.json (écrit par npm run archives)
    if (!__ARCHIVES_KEY__) {
        const response = await fetch("/acs-archives.json");
        return response.ok ? response.json() : { fields: [], seasons: [] };
    }
    // archives.enc est publié à la racine du site, la page admin dans admin/
    const response = await fetch(new URL("../archives.enc", location.href));
    if (!response.ok)
        throw new Error(`téléchargement impossible (${response.status})`);
    const encrypted = await response.arrayBuffer();
    try {
        return JSON.parse(await decryptArchive(encrypted, __ARCHIVES_KEY__));
    } catch {
        // Fichier pas encore régénéré après un changement du mot de passe admin
        throw new Error("le fichier ne se déchiffre pas (il est régénéré au prochain passage de la mise à jour)");
    }
};

// Une nouvelle tentative est possible après un échec (réseau...)
export const loadArchive = () => {
    loading ??= fetchArchive().catch((e) => {
        loading = null;
        throw e;
    });
    return loading;
};
