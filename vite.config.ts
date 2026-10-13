import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
    define: {
        // Date de génération de la page, affichée sur celle-ci
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
        // Clé de archives.enc : seulement dans la page admin (voir buildadmin.js)
        __ARCHIVES_KEY__: JSON.stringify(""),
    },
    plugins: [
        viteSingleFile({
            removeViteModuleLoader: true,
        }),
    ],
})
