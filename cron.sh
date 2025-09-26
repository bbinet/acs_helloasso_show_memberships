#!/usr/bin/env bash

(cd /home/acs-technolac/acs_helloasso_show_memberships;
    cp acs.json acs.json.old;
    npm run acsdata;
    cmp -s acs.json acs.json.old && echo "Nothing to do." && exit 0;
    npm run build;

    (cd /home/acs-technolac/acs_helloasso_show_memberships/gh-pages;
        cp ../dist/index.html index.html;
        git commit -a -m "Update index.html" && git push
    )
)
