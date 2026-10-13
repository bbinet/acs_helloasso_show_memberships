// Chiffrement des données des saisons archivées (archives.enc, publié sur le site) : AES-GCM, avec une clé dérivée
// du mot de passe de la page admin. Fonctions WebCrypto, communes à Node (archives.sh, cron.sh) et au navigateur.
// En JavaScript, pour être importable par les scripts Node sans compilation.

// Dérivation volontairement lente : chaque essai de mot de passe sur archives.enc coûte autant
const ITERATIONS = 600000;
const SALT = new TextEncoder().encode("acs-helloasso-archives");
const IV_LENGTH = 12;

const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const aesKey = (key) => crypto.subtle.importKey("raw", fromBase64(key), "AES-GCM", false, ["encrypt", "decrypt"]);

/** Clé AES (256 bits, en base64) dérivée du mot de passe admin : toujours la même pour un même mot de passe */
export async function deriveArchiveKey(password) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: SALT, iterations: ITERATIONS }, material, 256);
    return toBase64(new Uint8Array(bits));
}

/** Texte chiffré : vecteur d'initialisation aléatoire, suivi du texte chiffré et authentifié */
export async function encryptArchive(text, key) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key), new TextEncoder().encode(text));
    const result = new Uint8Array(IV_LENGTH + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), IV_LENGTH);
    return result;
}

/** Texte déchiffré ; erreur si la clé n'est pas la bonne ou si le fichier a été modifié */
export async function decryptArchive(bytes, key) {
    const data = new Uint8Array(bytes);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, IV_LENGTH) }, await aesKey(key), data.slice(IV_LENGTH));
    return new TextDecoder().decode(decrypted);
}
