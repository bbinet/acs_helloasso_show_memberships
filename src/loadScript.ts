// Charge un script depuis un CDN, une seule fois par adresse (une nouvelle tentative est possible après un échec réseau).
// L'empreinte « integrity » garantit que le fichier reçu est exactement celui attendu.
const loading = new Map<string, Promise<void>>();

export const loadScript = ({ src, integrity }: { src: string; integrity: string }) => {
    let promise = loading.get(src);
    if (!promise) {
        promise = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.integrity = integrity;
            script.crossOrigin = "anonymous";
            script.onload = () => resolve();
            script.onerror = () => {
                loading.delete(src);
                script.remove();
                reject(new Error(`Chargement impossible : ${src}`));
            };
            document.head.append(script);
        });
        loading.set(src, promise);
    }
    return promise;
};
