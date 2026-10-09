#!/usr/bin/env bash
# Régénère les pages des saisons archivées déclarées dans config.json et les publie sur gh-pages
# si leurs données ou le code des pages ont changé (empreinte gardée dans gh-pages/archives/.acs.sha256).
# Usage : ./archives.sh [-f]   (-f : publier même si rien n'a changé)
set -e
cd "$(dirname "$0")"
# Fichiers servant à construire les pages : leur contenu fait partie de l'empreinte, pour que
# les pages soient aussi republiées quand ils sont modifiés (et pas seulement quand les données changent).
build_files="src index.html vite.config.ts package.json package-lock.json .staticrypt.json"

npm run archives
hash=$( { find acs-archives -name '*.json' | sort | xargs -r sha256sum; git ls-files -s $build_files; } | sha256sum | cut -d' ' -f1)
if [ "$1" != "-f" ] && [ "$hash" = "$(cat gh-pages/archives/.acs.sha256 2>/dev/null)" ]; then
    echo "Nothing to do."
    exit 0
fi

cd gh-pages
rm -rf archives
cp -r ../dist/archives archives
echo "$hash" > archives/.acs.sha256
git add -A archives
git diff --cached --quiet && echo "Nothing to do." && exit 0
git commit -m "Update archives"
git push
