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
suivantes sont archivées : elles ne sont visibles que dans la page
d'administration (voir ci-dessous) :

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

## Données des saisons archivées

    $ ./archives.sh

récupère sur HelloAsso les saisons archivées (liste des adhérents, et adhésions
résumées pour les statistiques) et les publie dans un seul fichier,
`gh-pages/archives.enc`, chiffré (AES) avec une clé dérivée du mot de passe de
la page admin : il est public, mais seul le bureau peut le lire. La page admin,
qui contient la clé, ne le télécharge qu'à l'ouverture de l'onglet Statistiques
ou au choix d'une saison archivée dans l'onglet Adhérents :
elle reste légère, quel que soit le nombre de saisons archivées. Une copie en
clair, `acs-archives.json` (non publiée), sert au serveur de développement. Une saison
terminée ne changeant plus, ce fichier n'est récupéré sur HelloAsso qu'une fois :
`cron.sh` lance lui-même `./archives.sh --if-needed`, qui ne le régénère que
s'il manque, s'il ne contient pas toutes les saisons archivées de `config.json`
ou s'il ne se déchiffre plus (mot de passe admin changé).

## Passer à une nouvelle saison

1. Ajouter la nouvelle saison en tête de `conf.seasons` dans `config.json`.
2. Au prochain passage du cron (ou en lançant `./cron.sh`), la saison qui vient
   de se terminer est ajoutée aux données des saisons archivées, et la page de
   la nouvelle saison est publiée.

# Page d'administration : adhérents, factures et statistiques

La page `/admin/` est réservée au bureau. Elle a son propre mot de passe, différent de celui de la page des
adhérents, qui ne change pas. Elle a trois onglets.

**Adhérents** (onglet ouvert par défaut) : la même liste que la page des adhérents, avec le filtre par activité,
la recherche, le tri et la copie des emails des résultats, pour la saison en cours ou, au choix, pour une saison
archivée (téléchargée au premier choix, voir « Données des saisons archivées »).

**Factures et exports** : la liste des adhésions de la saison en cours (une par adhésion non remboursée), avec le
téléphone des adhérents (visible seulement ici et dans l'export CSV), 100 par page (choix et pages en bas de
la liste, comme dans l'onglet Adhérents), avec :

- une recherche (nom, entreprise, email, n°) et des filtres par activité, tarif, période d'inscription et
  statut d'envoi de la facture ;
- l'export CSV (pour Excel) et la copie des emails des adhésions sélectionnées (par exemple toutes celles d'un
  filtre, avec « Tout sélectionner »), au format
  `"Prénom Nom" <email>`, à coller dans un mail ;
- pour chaque adhésion, la facture en PDF, générée dans le navigateur (modèle repris de
  `acs_helloasso_invoicing`), à voir, télécharger ou envoyer par email ; l'envoi groupé des factures
  sélectionnées (par exemple toutes celles du filtre « À envoyer »), avec un avertissement pour celles déjà
  envoyées ;
- le suivi de l'envoi : envoyée, erreur, ou non distribuée (mail d'erreur reçu après l'envoi).

**Statistiques**, en trois sous-onglets :
- **Bilan de saison** : chiffres clés (adhérents et montant encaissé, avec l'écart par rapport à la saison
  précédente ; factures envoyées, à envoyer, en erreur), inscriptions depuis le début de la saison, adhérents par
  tarif, adhérents et recettes par activité (avec la liste des adhérents) et nombre d'activités par adhérent. La
  saison en cours est affichée par défaut ; on peut choisir une saison archivée, sans les listes d'adhérents ni
  l'envoi des factures ;
- **Comparaison des saisons** : inscriptions au fil de la saison comparées à toutes les saisons précédentes,
  adhérents et montant encaissé de chaque saison au même jour qu'aujourd'hui et en fin de saison, puis
  inscriptions par mois (de septembre à août) et nombre d'activités par adhérent face à la saison précédente ;
- **Comparaison des saisons par activité** : les adhérents de chaque activité saison par saison, avec l'écart
  par rapport à la saison précédente au même jour de saison, et un graphe par activité.

Les activités et les tarifs sont ceux de HelloAsso : un changement de nom ou une nouvelle activité y apparaît
automatiquement. Les comparaisons utilisent les données des saisons archivées (voir « Données des saisons
archivées »), récupérées sur HelloAsso une seule fois. La page n'appelle jamais HelloAsso : son secret reste dans
GitHub Actions.

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

# Ligne de commande : adhérents dans le terminal

`cli.sh` affiche ou exporte les adhérents d'une saison, lus directement sur
HelloAsso avec `config.json` (les adhésions remboursées sont exclues) :

    $ ./cli.sh                                  # saison en cours, une fiche par adhésion
    $ ./cli.sh --season 2025-2026 --activity "foot|tennis"
    $ ./cli.sh --search dupont --from 2026-09-01 --to 2026-09-30
    $ ./cli.sh --format summary                 # nombre d'adhérents par activité
    $ ./cli.sh --format summary-members         # idem, avec les adhérents de chaque activité
    $ ./cli.sh --format csv > adherents.csv     # même CSV que l'export de la page admin
    $ ./cli.sh --activity yoga --format emails  # adresses à coller dans un email
    $ ./cli.sh --pattern '{lastName};{firstName};{email}'

`--activity` et `--formula` sont des expressions régulières, sans tenir compte
des majuscules. Le nombre d'adhésions s'affiche sur la sortie d'erreur, pour
garder un fichier propre en cas de redirection. Toutes les options :
`./cli.sh --help`.

Complétion des options, formats et saisons dans bash : générer le script une
fois (à refaire quand les saisons de `config.json` changent), puis le charger
dans `~/.bashrc` (pour zsh : `--completion zsh` et `~/.zshrc`) :

    $ ./cli.sh --completion bash > ~/.acs-cli-completion.bash
    $ echo 'source ~/.acs-cli-completion.bash' >> ~/.bashrc

# GitHub Actions

Deux workflows ont besoin du secret `CONFIG_JSON` contenant tout le fichier
`config.json` (Settings > Secrets and variables > Actions), et `cron.yml` du secret facultatif
`INVOICE_SIGNATURE` (signature des factures, voir ci-dessus) :

- `cron.yml` exécute `cron.sh` deux fois par jour, à 8h23 et 11h48, et à la
  demande depuis l'onglet Actions (« Run workflow »). GitHub peut retarder de
  plusieurs heures (voire sauter) un lancement planifié (surtout aux heures de
  pointe) : le second lancement de la journée rattrape le premier. Chaque
  lancement planifié réactive aussi le workflow, pour que GitHub ne le
  désactive pas après 60 jours sans activité sur le dépôt.
- `archives.yml` exécute `archives.sh` à la demande depuis l'onglet Actions, pour
  récupérer à nouveau les saisons archivées : rarement utile, `cron.sh` le fait
  déjà quand il le faut.

`cron.yml` est aussi lancé à chaque mise à jour de `master`, pour publier tout de
suite une modification du code des pages (fichiers listés dans `build_files`
dans `cron.sh`).

`cron.sh` ne publie que si les données ou le code des pages ont changé : une
empreinte de ce qui est publié est gardée dans `gh-pages/.acs.sha256`.

La mise en ligne du site après chaque publication sur `gh-pages` est ensuite
faite par le workflow `pages-build-deployment` de GitHub Pages.

# Évolutions envisagées

- **Factures** : télécharger toutes les factures sélectionnées en une seule archive ZIP.
- **Page admin sur téléphone** : les filtres, les boutons, les statistiques et la liste des adhérents s'adaptent
  déjà aux petits écrans, mais le tableau des factures déborde encore (une présentation en fiches, comme la liste
  des adhérents, serait plus lisible).
