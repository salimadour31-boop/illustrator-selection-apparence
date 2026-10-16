# illustrator-selection-apparence

**SelectionParApparence.jsx** — sélectionne les objets Adobe Illustrator dont l'apparence (fond, contour, épaisseur) correspond à une référence ou à des critères manuels (ExtendScript, FR/EN).
*Selects Adobe Illustrator objects whose appearance (fill, stroke, stroke weight) matches a reference or manual criteria.*

> **Statut : non testé dans Illustrator.** La syntaxe ES3 a été vérifiée automatiquement (acorn) et la logique relue, mais le script n'a pas encore été exécuté dans Illustrator. Travaillez sur une **copie** de votre fichier.
> *Status: not tested in Illustrator. ES3 syntax checked (acorn) and logic reviewed only. Work on a copy of your file.*

## Pourquoi / Why

Changer d'un coup tous les objets qui partagent le même fond rouge, le même contour noir 0,5 pt, ou « tout ce qui n'a pas de fond » est une tâche quotidienne. La pipette et *Sélection > Même* d'Illustrator couvrent une partie des cas, mais pas la combinaison fond + contour + épaisseur avec tolérance, ni un mode d'analyse sans modifier la sélection, ni une portée limitée au calque actif.

Ce script propose :

| Fonction | Détail |
|---|---|
| Depuis la sélection | Lit le 1er objet utilisable (fond, contour, épaisseur) |
| Critères manuels | RVB 0–255, ou « aucun fond / aucun contour », + épaisseur en pt |
| Correspondances | Cochez fond, contour et/ou épaisseur indépendamment |
| Tolérances | Δ canaux couleur, Δ épaisseur (pt) |
| Portée | Document entier ou calque actif (+ sous-calques) |
| Analyser | Compte les correspondances **sans** changer la sélection |
| Sélectionner | Remplace la sélection (opération annulable si `beginUndoGroup` est disponible) |

Couleurs prises en charge pour la comparaison : RVB, CMJN, niveaux de gris, tons directs (nom + teinte). Les dégradés et motifs ne matchent que par type (égalité stricte). Les groupes sont parcourus ; un groupe n'est référence que s'il ne contient qu'un seul enfant utilisable.

## Installation

- **Ponctuelle** : dans Illustrator, *Fichier > Scripts > Autre script…* (Ctrl+F12 / Cmd+F12), puis choisir `SelectionParApparence.jsx`.
- **Permanente** : copier `SelectionParApparence.jsx` dans le dossier `Presets/<langue>/Scripts` d'Illustrator, puis redémarrer Illustrator :
  - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts`
  - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts`

  Le script apparaît alors dans *Fichier > Scripts*.

## Utilisation / Usage

1. Ouvrez un document (un message s'affiche si aucun n'est ouvert).
2. (Optionnel) Sélectionnez un objet dont vous voulez retrouver les jumeaux.
3. Lancez le script. Choisissez *Depuis la sélection* ou *Manuels*, cochez fond / contour / épaisseur, ajustez les tolérances et la portée.
4. **Analyser** : affiche le nombre de correspondances, sans toucher à la sélection.
5. **Sélectionner** : sélectionne tous les objets correspondants. Ctrl+Z / Cmd+Z pour annuler si Illustrator le permet.
6. Si rien n'est sélectionné au lancement, seuls les critères manuels sont disponibles.

L'interface est en français si Illustrator est en français, sinon en anglais.

## Version ciblée / Target

Illustrator CC 2018 et versions plus récentes (ExtendScript ES3, ScriptUI). Pas d'UXP nécessaire.

## Limites connues / Known limits

- Non testé dans Illustrator : signalez tout problème dans les *Issues*.
- Les aspects complexes (plusieurs fonds/contours dans le panneau Aspect, styles graphiques) ne sont pas lus via l'API de base : seul le fond/contour « principal » de l'objet est pris en compte.
- Les objets à l'intérieur des symboles ne sont pas parcourus.
- La tolérance couleur est une distance euclidienne simple sur les canaux (pas ΔE Lab).

## Projets similaires / Similar projects

Code 100 % original. Illustrator propose *Sélection > Même > Couleur de fond / Couleur de contour / Épaisseur de contour*. Des scripts communautaires existent pour des sélections avancées ; celui-ci est gratuit, bilingue FR/EN, combine les critères avec tolérance et propose une analyse sans modification.

## Confidentialité / Privacy

Aucun appel réseau, aucune collecte de données, aucun fichier écrit.

## Licence

MIT — © 2026 Amirouche Amwanes. Voir `LICENSE`.
