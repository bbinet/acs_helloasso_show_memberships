# Setup the project

    $ npm install

## Setup worktree to publish to Github pages

    $ git worktree add gh-pages/ gh-pages

# Run the project

## Download current HelloAsso data

    $ npm run acsdata

## Build the all-in-one encrypted web pages

    $ npm run build

This builds `dist/index.html` (members list) and, when an admin password is
configured, `dist/admin/index.html` (invoices, see below).

## Run the tests

    $ npm test

## Publish to Github pages

    $ cp dist/index.html gh-pages/index.html
    $ rm -rf gh-pages/admin && cp -r dist/admin gh-pages/admin
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

# Page d'administration : adhérents, factures et statistiques

La page `/admin/` est réservée au bureau. Elle a son propre mot de passe, différent de celui de la page des
adhérents, qui ne change pas. Elle a trois onglets.

**Adhérents** (onglet ouvert par défaut) : la même liste que la page des adhérents, avec le filtre par activité,
la recherche et le tri.

**Factures et exports** : la liste des adhésions de la saison en cours (une par adhésion non remboursée), avec le
téléphone des adhérents (visible seulement ici et dans l'export CSV), 100 par page, avec :

- une recherche (nom, entreprise, email, n°) et des filtres par activité, tarif, période d'inscription et
  statut d'envoi de la facture ;
- l'export CSV de la liste filtrée (pour Excel) et la copie des emails de la liste filtrée, au format
  `"Prénom Nom" <email>`, à coller dans un mail ;
- pour chaque adhésion, la facture en PDF, générée dans le navigateur (modèle repris de
  `acs_helloasso_invoicing`), à voir, télécharger ou envoyer par email ; l'envoi groupé des factures cochées
  ou de toutes celles pas encore envoyées ;
- le suivi de l'envoi : envoyée, erreur, ou non distribuée (mail d'erreur reçu après l'envoi).

**Statistiques**, en trois sous-onglets :
- **Bilan de saison** : chiffres clés (adhérents, montant encaissé, factures envoyées, à envoyer, en erreur),
  inscriptions depuis le début de la saison, adhérents par tarif, adhérents et recettes par activité (avec la
  liste des adhérents), inscriptions par mois et nombre d'activités par adhérent ;
- **Comparaison des saisons** : inscriptions au fil de la saison comparées à toutes les saisons précédentes,
  adhérents et montant encaissé par saison ;
- **Comparaison des saisons par activité** : les adhérents de chaque activité saison par saison, avec l'écart
  par rapport à la saison précédente au même jour de saison, et un graphe par activité.

Les activités et les tarifs sont ceux de HelloAsso : un changement de nom ou une nouvelle activité y apparaît
automatiquement. Pour les comparaisons, le cron garde un résumé de chaque saison archivée (date, activités, tarif
et montant de chaque adhésion, sans nom ni email) dans `acs-history/`. Une saison terminée ne changeant plus, ce
résumé n'est récupéré sur HelloAsso qu'une fois, puis conservé d'une exécution à l'autre par le cache de GitHub
Actions. La page n'appelle jamais HelloAsso : son secret reste dans GitHub Actions.

Les graphes (Chart.js) et la génération des PDF (pdfmake) sont chargés depuis jsDelivr, avec une empreinte
d'intégrité, plutôt qu'intégrés à la page chiffrée.

L'envoi passe par un script Google Apps Script du compte acs.tresorier@gmail.com, qui tient aussi le registre
des envois (un onglet par saison dans une feuille Google Sheets) : voir [apps-script/README.md](apps-script/README.md) pour l'installer.

Paramètres dans `config.json` (tous facultatifs sauf le mot de passe admin) :

    {
      "conf": {
        ...
        "invoicing": {
          "issuer": {
            "name": "Nathalie Baillet",
            "title": "Trésorière, membre du CA de l'ACS",
            "email": "acs.tresorier@gmail.com"
          }
        }
      },
      "credentials": {
        ...
        "staticrypt": {
          "password": "<mot de passe de la page des adhérents>",
          "admin_password": "<mot de passe de la page admin>"
        },
        "invoicing": {
          "script_url": "https://script.google.com/macros/s/.../exec",
          "token": "<propriété TOKEN du script>"
        }
      }
    }

- Sans `admin_password`, la page admin n'est pas générée. Les mots de passe doivent faire au moins 14
  caractères : sinon `staticrypt` demande une confirmation et la publication automatique reste bloquée.
- `issuer` est le signataire des factures (par défaut celui indiqué ci-dessus).
- Sans `script_url`, la page admin permet seulement de voir et télécharger les factures.
- `script_url` est l'URL de l'application Web obtenue en déployant le script (`https://script.google.com/macros/s/.../exec`),
  et `token` la même valeur que la propriété `TOKEN` du script : voir [apps-script/README.md](apps-script/README.md).

L'image de la signature, ajoutée en bas des factures, est le fichier `signature.png` à la racine du projet
(il n'est pas versionné). Dans GitHub Actions, elle vient du secret `INVOICE_SIGNATURE`, qui contient le PNG
encodé en base64 (`base64 -w0 signature.png`), limité comme tout secret à 48 Ko.

Changer un mot de passe, le jeton ou la signature republie les pages au prochain passage du cron.

# GitHub Actions

Deux workflows ont besoin du secret `CONFIG_JSON` contenant tout le fichier
`config.json` (Settings > Secrets and variables > Actions), et `cron.yml` du secret facultatif
`INVOICE_SIGNATURE` (signature des factures, voir ci-dessus) :

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
