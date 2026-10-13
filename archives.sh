#!/usr/bin/env bash
# Récupère sur HelloAsso les saisons archivées déclarées dans config.json (toutes sauf la première) et publie
# leurs données, chiffrées avec le mot de passe admin, dans gh-pages/archives.enc : la page admin les télécharge
# quand on en a besoin (statistiques, listes des adhérents des saisons précédentes).
# Une saison terminée ne changeant plus, il suffit de le lancer au changement de saison : cron.sh le lance
# d'ailleurs lui-même (avec --if-needed) quand une saison archivée manque ou que le mot de passe admin a changé.
# Usage : ./archives.sh [--if-needed]
set -e
cd "$(dirname "$0")"

node src/buildarchives.js "$@"
[ -f archives.enc ] || exit 0

cd gh-pages
cp ../archives.enc archives.enc
git add archives.enc
# Anciennes pages publiques des saisons archivées, remplacées par la page admin
git rm -r -q --ignore-unmatch archives
git diff --cached --quiet && echo "Nothing to do." && exit 0
git commit -m "Update archived seasons"
git push
