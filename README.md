# Setup the project

    $ npm install

## Setup worktree to publish to Github pages

    $ git worktree add gh-pages/ gh-pages

# Run the project

## Download current HelloAsso data

    $ npm run acsdata

## Build the all-in-one encrypted web page

    $ npm run build

## Publish to Github pages

    $ cp dist/index.html gh-pages/index.html
    $ cd gh-pages/
    $ git commit -a -m "Update index.html"
    $ git push origin gh-pages

# Saisons d'adhésion

Les saisons sont déclarées dans `config.json`, de la plus récente à la plus
ancienne. La première est la saison en cours (publiée à la racine du site) :

    {
      "conf": {
        "helloasso": {
          "api_base": "...",
          "organization_name": "...",
          "formType": "Membership"
        },
        "seasons": [
          { "name": "2026/2027", "formSlug": "<slug du formulaire 2026/2027>" },
          { "name": "2025/2026", "formSlug": "<slug du formulaire 2025/2026>" }
        ]
      },
      "credentials": { ... }
    }

## Passer à une nouvelle saison

1. Ajouter la nouvelle saison en tête de `conf.seasons` dans `config.json`.
2. La page de la nouvelle saison sera publiée au prochain passage du cron
   (ou lancer `./cron.sh`).
