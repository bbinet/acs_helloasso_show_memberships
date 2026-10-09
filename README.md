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
ancienne. La première est la saison en cours (publiée à la racine du site), les
suivantes sont archivées (publiées dans `archives/<saison>/`) :

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

## Régénérer les pages d'archives

    $ npm run archives

Les pages sont générées dans `dist/archives/`. Elles ne sont pas liées depuis la
page de la saison en cours : la liste des saisons archivées est accessible à
l'adresse `/archives/`. Pour les régénérer et les publier
directement sur Github pages :

    $ ./archives.sh

Comme pour le cron, rien n'est publié si ni les données HelloAsso des saisons
archivées ni le code des pages n'ont changé depuis la dernière publication (une
empreinte est gardée dans `gh-pages/archives/.acs.sha256`). Pour forcer la
publication :

    $ ./archives.sh -f

## Passer à une nouvelle saison

1. Ajouter la nouvelle saison en tête de `conf.seasons` dans `config.json`.
2. Lancer `./archives.sh` pour publier la page de la saison qui vient de se
   terminer dans les archives.
3. La page de la nouvelle saison sera publiée au prochain passage du cron
   (ou lancer `./cron.sh`).

# GitHub Actions

Deux workflows ont besoin du secret `CONFIG_JSON` contenant tout le fichier
`config.json` (Settings > Secrets and variables > Actions) :

- `cron.yml` exécute `cron.sh` tous les jours à 10h00 UTC (11h00 à Paris en heure
  d'hiver, 12h00 en heure d'été), et à la demande depuis l'onglet Actions
  (« Run workflow »).
- `archives.yml` exécute `archives.sh` à la demande depuis l'onglet Actions.
  L'option « Publier même si les données n'ont pas changé » correspond à
  `./archives.sh -f`.

Les deux workflows sont aussi lancés à chaque mise à jour de `master`, pour
publier tout de suite une modification du code des pages (fichiers listés dans
`build_files` dans `cron.sh` et `archives.sh`).

Les scripts ne publient que si les données ou le code des pages ont changé : une
empreinte de ce qui est publié est gardée dans `gh-pages/.acs.sha256` et
`gh-pages/archives/.acs.sha256`.

La mise en ligne du site après chaque publication sur `gh-pages` est ensuite
faite par le workflow `pages-build-deployment` de GitHub Pages.
