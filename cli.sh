#!/bin/sh
# Adhérents d'une saison dans le terminal (voir ./cli.sh --help et la section « Ligne de commande » du README)
cd "$(dirname "$0")" || exit 1
if [ ! -x node_modules/.bin/vite-node ]; then
    echo "vite-node n'est pas installé : lancer d'abord « npm install »." >&2
    exit 1
fi
exec node_modules/.bin/vite-node src/members.ts -- "$@"
