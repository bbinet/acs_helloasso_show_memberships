#!/usr/bin/env bash
# Régénère la page de la saison en cours et la publie sur gh-pages si les données ou le code
# de la page ont changé. Une empreinte de ce qui est publié est gardée dans gh-pages/.acs.sha256.
set -e
cd "$(dirname "$0")"
# Fichiers servant à construire les pages : leur contenu fait partie de l'empreinte, pour que
# les pages soient aussi republiées quand ils sont modifiés (et pas seulement quand les données changent).
build_files="src index.html vite.config.ts package.json package-lock.json .staticrypt.json"

npm run acsdata
hash=$( { cat acs.json; git ls-files -s $build_files; } | sha256sum | cut -d' ' -f1)
if [ "$hash" = "$(cat gh-pages/.acs.sha256 2>/dev/null)" ]; then
    echo "Nothing to do."
    exit 0
fi
npm run build

cd gh-pages
cp ../dist/index.html index.html
echo "$hash" > .acs.sha256
git add index.html .acs.sha256
git diff --cached --quiet && echo "Nothing to do." && exit 0
git commit -m "Update index.html"
git push
