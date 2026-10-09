#!/usr/bin/env bash
# Régénère la page de la saison en cours et la publie sur gh-pages si les données ont changé.
# Une empreinte des données publiées est gardée dans gh-pages/.acs.sha256 pour le savoir.
set -e
cd "$(dirname "$0")"

npm run acsdata
hash=$(sha256sum acs.json | cut -d' ' -f1)
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
