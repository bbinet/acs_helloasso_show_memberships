import { describe, expect, it } from "vitest";
import { decryptArchive, deriveArchiveKey, encryptArchive } from "../src/ArchiveCrypto.js";

describe("chiffrement des saisons archivées", () => {
    const content = JSON.stringify({ seasons: [{ season: "2025-2026", members: [["Jean", "Dupont", "", "jean@example.com", "Tennis"]] }] });

    it("dérive toujours la même clé d'un même mot de passe, et une autre clé d'un autre mot de passe", async () => {
        const key = await deriveArchiveKey("motdepasse-bureau-test");
        expect(key).toBe(await deriveArchiveKey("motdepasse-bureau-test"));
        expect(key).not.toBe(await deriveArchiveKey("autre-mot-de-passe"));
    });

    it("déchiffre avec la clé le fichier chiffré avec elle, dont le contenu n'apparaît pas en clair", async () => {
        const key = await deriveArchiveKey("motdepasse-bureau-test");
        const encrypted = await encryptArchive(content, key);
        expect(new TextDecoder().decode(encrypted)).not.toContain("jean@example.com");
        expect(await decryptArchive(encrypted, key)).toBe(content);
    });

    it("refuse de déchiffrer avec une autre clé", async () => {
        const encrypted = await encryptArchive(content, await deriveArchiveKey("motdepasse-bureau-test"));
        await expect(decryptArchive(encrypted, await deriveArchiveKey("autre-mot-de-passe"))).rejects.toThrow();
    });
});
