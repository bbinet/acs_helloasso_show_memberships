#!/usr/bin/env bash
# Régénère les pages des saisons archivées déclarées dans config.json et les publie sur gh-pages
# si leurs données ont changé (empreinte gardée dans gh-pages/archives/.acs.sha256).
# Usage : ./archives.sh [-f]   (-f : publier même si les données n'ont pas changé)
set -e
cd "$(dirname "$0")"

npm run archives
hash=$(find acs-archives -name '*.json' | sort | xargs -r sha256sum | sha256sum | cut -d' ' -f1)
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
