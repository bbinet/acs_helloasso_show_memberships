# Script d'envoi des factures (Google Apps Script)

La page d'administration (`/admin/`) génère les factures en PDF dans le navigateur, puis les confie à ce
script, qui tourne sur le compte Google **acs.tresorier@gmail.com** :

- il envoie la facture par email depuis ce compte (copie dans « Envoyés »), au payeur de l'adhésion tel que
  connu de HelloAsso : l'adresse n'est jamais prise dans la demande de la page ;
- il refuse une adhésion remboursée, une commande qui n'est pas une adhésion, et une facture déjà envoyée
  (sauf « Renvoyer ») ;
- il tient le registre des envois, un onglet par saison : « Factures 2026-2027 » (n°, nom, email, date,
  statut, détail) ;
- il archive les PDF envoyés dans un dossier Google Drive, un sous-dossier par saison : « 2026-2027 »
  (optionnel) ;
- chaque jour vers 7h, il lit les mails d'erreur reçus (adresse introuvable, boîte pleine...) et passe les
  factures concernées en « non distribuée ».

Le code est dans `Code.js`, testé par `tests/apps-script/` (`npm test`).

## Installation

Tout se fait avec le compte **acs.tresorier@gmail.com** : si plusieurs comptes Google sont connectés dans le
navigateur, vérifier en haut à droite de chaque page que c'est bien ce compte qui est utilisé (sinon, cliquer
sur l'avatar pour en changer).

1. Sur `https://sheets.google.com`, créer une feuille vide, par exemple « Factures ACS ». L'onglet de chaque
   saison (« Factures 2026-2027 ») sera créé au premier envoi de la saison. Noter l'identifiant de la feuille,
   au milieu de son adresse : `https://docs.google.com/spreadsheets/d/<identifiant>/edit`.
2. (Optionnel) Sur `https://drive.google.com`, créer le dossier d'archive des factures, par exemple
   « Factures ACS - PDF ». Le sous-dossier de chaque saison (« 2026-2027 ») y sera créé au premier envoi de la
   saison. Noter son identifiant, à la fin de son adresse : `https://drive.google.com/drive/folders/<identifiant>`.
3. Sur `https://script.google.com/home`, cliquer sur **Nouveau projet** et le renommer « Factures ACS ».
   Remplacer le contenu de `Code.gs` par celui de `apps-script/Code.js`, et enregistrer.
4. **Paramètres du projet** (roue dentée, à gauche) : choisir le fuseau horaire de Paris, puis dans
   **Propriétés du script**, ajouter :

   | Propriété | Valeur |
   |---|---|
   | `SHEET_ID` | identifiant de la feuille (étape 1) |
   | `TOKEN` | un jeton aléatoire d'au moins 32 caractères (par exemple `openssl rand -hex 24`) |
   | `HELLOASSO_ID` | identifiant de l'API HelloAsso |
   | `HELLOASSO_SECRET` | secret de l'API HelloAsso |
   | `DRIVE_FOLDER_ID` | (optionnel) identifiant du dossier Drive d'archive des factures (étape 2) |
   | `MAIL_SUBJECT` | (optionnel) objet du mail, « Facture adhésion ACS » par défaut ; le n° de facture est toujours ajouté à la fin |
   | `MAIL_BODY` | (optionnel) texte du mail (`\n` pour un retour à la ligne) |
   | `MAIL_NAME` | (optionnel) nom de l'expéditeur, « ACS Savoie Technolac » par défaut |

5. Dans l'éditeur, choisir la fonction `installTrigger` et cliquer sur **Exécuter**. Google demande alors
   d'autoriser le script (Gmail, Sheets, Drive, accès à HelloAsso) : choisir le compte acs.tresorier@gmail.com
   et accepter. L'écran « Google n'a pas validé cette application » est normal pour un script personnel :
   **Paramètres avancés > Accéder à Factures ACS (non sécurisé)**. Le déclencheur `checkBounces`, quotidien,
   apparaît ensuite dans **Déclencheurs** (icône réveil).
6. **Déployer > Nouveau déploiement**, type **Application Web** :
   - Exécuter en tant que : **Moi** (acs.tresorier@gmail.com) ;
   - Qui peut accéder : **Tout le monde** (la page n'est pas connectée à Google : c'est le jeton qui protège
     le script).

   Copier l'**URL de l'application Web** (`https://script.google.com/macros/s/.../exec`).
7. Ajouter l'URL et le jeton dans le secret `CONFIG_JSON` du dépôt (voir le README principal), puis relancer
   le workflow « Mise à jour de la saison en cours ».

Après une modification de `Code.js`, coller le nouveau code puis **Déployer > Gérer les déploiements >
Modifier > Nouvelle version** : l'URL ne change pas.

## Sécurité

- Les identifiants HelloAsso sont dans les propriétés du script, visibles seulement des personnes qui
  peuvent modifier le projet : ne pas le partager, et activer la validation en deux étapes du compte.
- Le jeton est intégré à la page admin, chiffrée par son mot de passe : toute personne qui a ce mot de passe
  peut envoyer des factures, mais seulement aux payeurs des adhésions HelloAsso.
- En cas de fuite du jeton : changer `TOKEN` dans les propriétés du script et dans `CONFIG_JSON`.

## Limites

- Gmail limite l'envoi à environ 100 destinataires par jour pour un compte gratuit. L'envoi groupé s'arrête
  quand le quota est atteint, et reprend où il s'était arrêté le lendemain.
- Un mail arrivé dans les spams du destinataire, ou un serveur qui ne renvoie pas de mail d'erreur, ne peuvent
  pas être détectés.
