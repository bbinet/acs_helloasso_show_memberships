#!/usr/bin/env bash
# Régénère la page de la saison en cours et la page d'administration (admin/, factures), et les publie
# sur gh-pages si les données, le code des pages ou les mots de passe et paramètres d'envoi ont changé.
# Une empreinte de ce qui est publié est gardée dans gh-pages/.acs.sha256.
set -e
cd "$(dirname "$0")"
# Fichiers servant à construire les pages : leur contenu fait partie de l'empreinte, pour que
# les pages soient aussi republiées quand ils sont modifiés (et pas seulement quand les données changent).
build_files="src index.html admin vite.config.ts package.json package-lock.json .staticrypt.json"

npm run acsdata
hash=$( { cat acs.json acs-admin.json; jq -c .credentials.staticrypt config.json; git ls-files -s $build_files; } | sha256sum | cut -d' ' -f1)
if [ "$hash" = "$(cat gh-pages/.acs.sha256 2>/dev/null)" ]; then
    echo "Nothing to do."
    exit 0
fi
npm run build

cd gh-pages
cp ../dist/index.html index.html
rm -rf admin
[ -d ../dist/admin ] && cp -r ../dist/admin admin
echo "$hash" > .acs.sha256
git add index.html .acs.sha256
# admin/ peut ne pas exister (pas de mot de passe admin) : git add échoue alors s'il n'a jamais été publié
git add -A admin 2>/dev/null || true
git diff --cached --quiet && echo "Nothing to do." && exit 0
git commit -m "Update index.html and admin"
git push
