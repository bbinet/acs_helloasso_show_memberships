#!/usr/bin/env bash
# Régénère et publie les pages des saisons archivées déclarées dans config.json
# Usage : ./archives.sh [-f]   (-f : publier même si les données n'ont pas changé)

(cd /home/acs-technolac/acs_helloasso_show_memberships;
    rm -rf acs-archives.old;
    [ -d acs-archives ] && cp -r acs-archives acs-archives.old;
    npm run archives || exit 1;
    [ "$1" != "-f" ] && diff -rq acs-archives acs-archives.old > /dev/null 2>&1 && echo "Nothing to do." && exit 0;

    (cd /home/acs-technolac/acs_helloasso_show_memberships/gh-pages;
        rm -rf archives;
        cp -r ../dist/archives archives;
        git add -A archives;
        git commit -m "Update archives" && git push
    )
)
