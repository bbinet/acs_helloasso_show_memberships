import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
    define: {
        // Date de génération de la page, affichée sur celle-ci
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
        viteSingleFile({
            removeViteModuleLoader: true,
        }),
    ],
})
