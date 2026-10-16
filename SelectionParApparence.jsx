//@target illustrator
/*
 * SelectionParApparence.jsx  —  v1.0.0
 * ----------------------------------------------------------------------------
 * FR : Sélectionne les objets dont l'apparence (fond, contour, épaisseur)
 *      correspond à un objet de référence (1er de la sélection) ou à des
 *      critères manuels. Portée document ou calque actif. Tolérance couleur.
 *      Bouton « Analyser » : compte les correspondances sans modifier.
 *      Bouton « Sélectionner » : remplace la sélection courante.
 * EN : Selects objects whose appearance (fill, stroke, stroke weight)
 *      matches a reference object (first in selection) or manual criteria.
 *      Scope: document or active layer. Color tolerance.
 *      "Analyze" button: count matches without changing anything.
 *      "Select" button: replaces the current selection.
 *
 * Cible / Target : Illustrator CC (2018+) jusqu'aux versions récentes.
 * Statut / Status : NON TESTÉ DANS ILLUSTRATOR — syntaxe ES3 vérifiée (acorn).
 *                   NOT TESTED IN ILLUSTRATOR — ES3 syntax checked (acorn).
 * Conseil : travaillez sur une copie de votre fichier.
 * Tip     : work on a copy of your file.
 * Aucune connexion réseau, aucune collecte de données.
 * No network access, no data collection.
 *
 * Licence MIT — (c) 2026 Amirouche Amwanes. Code original.
 */

(function () {

    var VERSION = "1.0.0";

    // ------------------------------------------------------------------
    // Langue / Language
    // ------------------------------------------------------------------
    var FR = String($.locale || app.locale || "").toLowerCase().indexOf("fr") === 0;
    function t(fr, en) { return FR ? fr : en; }

    // ------------------------------------------------------------------
    // Garde-fous / Guards
    // ------------------------------------------------------------------
    if (app.documents.length === 0) {
        alert(t("Aucun document ouvert.\nOuvrez un document puis relancez le script.",
                "No document open.\nOpen a document and run the script again."));
        return;
    }

    var doc = app.activeDocument;

    // ------------------------------------------------------------------
    // Utilitaires ES3 / ES3 helpers
    // ------------------------------------------------------------------

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    function clamp(n, a, b) {
        if (n < a) return a;
        if (n > b) return b;
        return n;
    }

    /**
     * Convertit une Color Illustrator en tableau [type, c0, c1, c2, c3]
     * pour comparaison. null = aucun fond/contour / NoneColor.
     * Converts an Illustrator Color to [type, c0..c3] for comparison.
     */
    function colorKey(col) {
        if (!col) return null;
        var tn = safe(function () { return col.typename; }, "");
        if (!tn || tn === "NoColor" || tn === "NoneColor") return null;
        if (tn === "RGBColor") {
            return ["RGB",
                safe(function () { return col.red; }, 0),
                safe(function () { return col.green; }, 0),
                safe(function () { return col.blue; }, 0),
                0];
        }
        if (tn === "CMYKColor") {
            return ["CMYK",
                safe(function () { return col.cyan; }, 0),
                safe(function () { return col.magenta; }, 0),
                safe(function () { return col.yellow; }, 0),
                safe(function () { return col.black; }, 0)];
        }
        if (tn === "GrayColor") {
            return ["GRAY",
                safe(function () { return col.gray; }, 0),
                0, 0, 0];
        }
        if (tn === "SpotColor") {
            var spotName = safe(function () { return col.spot.name; }, "");
            var tint = safe(function () { return col.tint; }, 100);
            return ["SPOT", spotName, tint, 0, 0];
        }
        // GradientColor / PatternColor : clé opaque (égalité stricte typename)
        // GradientColor / PatternColor: opaque key (strict typename equality)
        return [tn, 0, 0, 0, 0];
    }

    /**
     * Distance approximative entre deux clés couleur (canaux 0–100 ou 0–255).
     * Approximate distance between two color keys.
     */
    function colorDistance(a, b) {
        if (a === null && b === null) return 0;
        if (a === null || b === null) return 9999;
        if (a[0] !== b[0]) return 9999;
        if (a[0] === "SPOT") {
            if (String(a[1]) !== String(b[1])) return 9999;
            return Math.abs(Number(a[2]) - Number(b[2]));
        }
        if (a[0] === "RGB") {
            var dr = a[1] - b[1], dg = a[2] - b[2], db = a[3] - b[3];
            return Math.sqrt(dr * dr + dg * dg + db * db);
        }
        if (a[0] === "CMYK") {
            var dc = a[1] - b[1], dm = a[2] - b[2], dy = a[3] - b[3], dk = a[4] - b[4];
            return Math.sqrt(dc * dc + dm * dm + dy * dy + dk * dk);
        }
        if (a[0] === "GRAY") {
            return Math.abs(a[1] - b[1]);
        }
        // Autres types : égalité stricte du typename seulement
        return 0;
    }

    function colorsMatch(a, b, tol) {
        return colorDistance(a, b) <= tol;
    }

    function weightsMatch(w1, w2, tol) {
        return Math.abs(Number(w1) - Number(w2)) <= tol;
    }

    /**
     * Lit l'apparence d'un pageItem (PathItem, CompoundPathItem, TextFrame…).
     * Reads appearance of a pageItem.
     */
    function readAppearance(item) {
        var result = {
            fill: null,
            stroke: null,
            weight: 0,
            hasFill: false,
            hasStroke: false,
            ok: false
        };
        if (!item) return result;

        var typ = safe(function () { return item.typename; }, "");

        // CompoundPathItem : premier PathItem enfant
        if (typ === "CompoundPathItem") {
            var kids = safe(function () { return item.pathItems; }, null);
            if (kids && kids.length > 0) {
                return readAppearance(kids[0]);
            }
            return result;
        }

        // GroupItem : non utilisable comme référence directe (sauf 1 enfant)
        if (typ === "GroupItem") {
            var gKids = safe(function () { return item.pageItems; }, null);
            if (gKids && gKids.length === 1) {
                return readAppearance(gKids[0]);
            }
            return result;
        }

        // PathItem / TextFrame / etc. avec filled/stroked
        var filled = safe(function () { return item.filled; }, false);
        var stroked = safe(function () { return item.stroked; }, false);

        if (filled) {
            result.hasFill = true;
            result.fill = colorKey(safe(function () { return item.fillColor; }, null));
        }
        if (stroked) {
            result.hasStroke = true;
            result.stroke = colorKey(safe(function () { return item.strokeColor; }, null));
            result.weight = safe(function () { return item.strokeWidth; }, 0);
        }
        result.ok = true;
        return result;
    }

    function itemIsHiddenOrLocked(item) {
        var locked = safe(function () { return item.locked; }, false);
        var hidden = safe(function () { return item.hidden; }, false);
        return locked || hidden;
    }

    function layerIsHiddenOrLocked(layer) {
        var locked = safe(function () { return layer.locked; }, false);
        var visible = safe(function () { return layer.visible; }, true);
        return locked || !visible;
    }

    /**
     * Collecte récursive des pageItems dans un calque (et sous-calques).
     * Recursive collection of pageItems in a layer (and sublayers).
     */
    function collectFromLayer(layer, out, includeLockedHidden) {
        if (!layer) return;
        if (!includeLockedHidden && layerIsHiddenOrLocked(layer)) return;

        var i, items, sub;

        items = safe(function () { return layer.pageItems; }, null);
        if (items) {
            for (i = 0; i < items.length; i++) {
                var it = items[i];
                if (!includeLockedHidden && itemIsHiddenOrLocked(it)) continue;
                var typ = safe(function () { return it.typename; }, "");
                if (typ === "GroupItem") {
                    collectFromGroup(it, out, includeLockedHidden);
                } else {
                    out.push(it);
                }
            }
        }

        sub = safe(function () { return layer.layers; }, null);
        if (sub) {
            for (i = 0; i < sub.length; i++) {
                collectFromLayer(sub[i], out, includeLockedHidden);
            }
        }
    }

    function collectFromGroup(group, out, includeLockedHidden) {
        if (!group) return;
        if (!includeLockedHidden && itemIsHiddenOrLocked(group)) return;
        var items = safe(function () { return group.pageItems; }, null);
        if (!items) return;
        var i;
        for (i = 0; i < items.length; i++) {
            var it = items[i];
            if (!includeLockedHidden && itemIsHiddenOrLocked(it)) continue;
            var typ = safe(function () { return it.typename; }, "");
            if (typ === "GroupItem") {
                collectFromGroup(it, out, includeLockedHidden);
            } else {
                out.push(it);
            }
        }
    }

    function collectCandidates(scopeActiveLayer, includeLockedHidden) {
        var out = [];
        if (scopeActiveLayer) {
            collectFromLayer(doc.activeLayer, out, includeLockedHidden);
        } else {
            var layers = doc.layers;
            var i;
            for (i = 0; i < layers.length; i++) {
                collectFromLayer(layers[i], out, includeLockedHidden);
            }
        }
        return out;
    }

    /**
     * Teste si un item correspond aux critères.
     * Tests whether an item matches the criteria.
     */
    function matchesCriteria(item, crit) {
        var app_ = readAppearance(item);
        if (!app_.ok) return false;

        if (crit.matchFill) {
            if (crit.requireFill) {
                if (!app_.hasFill) return false;
                if (!colorsMatch(app_.fill, crit.fillKey, crit.colorTol)) return false;
            } else {
                // « aucun fond » demandé
                if (app_.hasFill) return false;
            }
        }

        if (crit.matchStroke) {
            if (crit.requireStroke) {
                if (!app_.hasStroke) return false;
                if (!colorsMatch(app_.stroke, crit.strokeKey, crit.colorTol)) return false;
            } else {
                if (app_.hasStroke) return false;
            }
        }

        if (crit.matchWeight) {
            if (!app_.hasStroke) return false;
            if (!weightsMatch(app_.weight, crit.weight, crit.weightTol)) return false;
        }

        return true;
    }

    function findMatches(crit, scopeActiveLayer, includeLockedHidden) {
        var candidates = collectCandidates(scopeActiveLayer, includeLockedHidden);
        var matched = [];
        var i;
        for (i = 0; i < candidates.length; i++) {
            if (matchesCriteria(candidates[i], crit)) {
                matched.push(candidates[i]);
            }
        }
        return { total: candidates.length, matched: matched };
    }

    function selectItems(items) {
        // Désélectionner puis sélectionner
        safe(function () { doc.selection = null; }, null);
        var i;
        for (i = 0; i < items.length; i++) {
            try {
                items[i].selected = true;
            } catch (eSel) { /* ignore */ }
        }
    }

    function beginUndo(label) {
        safe(function () { app.beginUndoGroup(label); }, null);
    }
    function endUndo() {
        safe(function () { app.endUndoGroup(); }, null);
    }

    // ------------------------------------------------------------------
    // Référence depuis la sélection / Reference from selection
    // ------------------------------------------------------------------
    function getReferenceFromSelection() {
        var sel = safe(function () { return doc.selection; }, null);
        if (!sel || sel.length === 0) return null;
        var i;
        for (i = 0; i < sel.length; i++) {
            var app_ = readAppearance(sel[i]);
            if (app_.ok) {
                return { item: sel[i], appearance: app_ };
            }
        }
        return null;
    }

    var ref = getReferenceFromSelection();

    // ------------------------------------------------------------------
    // Dialogue ScriptUI / ScriptUI dialog
    // ------------------------------------------------------------------
    function buildDialog() {
        var dlg = new Window("dialog", t("Sélection par apparence v" + VERSION,
                                        "Select by Appearance v" + VERSION));
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 8;
        dlg.margins = 14;

        // Avertissement copie
        var tip = dlg.add("statictext", undefined,
            t("Conseil : travaillez sur une copie du fichier.",
              "Tip: work on a copy of your file."),
            { multiline: true });
        tip.characters = 52;

        // Source des critères
        var gSrc = dlg.add("panel", undefined, t("Critères", "Criteria"));
        gSrc.orientation = "column";
        gSrc.alignChildren = ["fill", "top"];
        gSrc.margins = 10;

        var rbRef = gSrc.add("radiobutton", undefined,
            t("Depuis la sélection (1er objet utilisable)",
              "From selection (first usable object)"));
        var rbMan = gSrc.add("radiobutton", undefined,
            t("Manuels (cochez fond / contour / épaisseur)",
              "Manual (check fill / stroke / weight)"));

        if (ref) {
            rbRef.value = true;
            var refInfo = gSrc.add("statictext", undefined, "", { multiline: true });
            refInfo.characters = 50;
            var parts = [];
            if (ref.appearance.hasFill) {
                parts.push(t("Fond", "Fill") + ": " + formatKey(ref.appearance.fill));
            } else {
                parts.push(t("Fond: aucun", "Fill: none"));
            }
            if (ref.appearance.hasStroke) {
                parts.push(t("Contour", "Stroke") + ": " + formatKey(ref.appearance.stroke) +
                    " · " + t("ép.", "wt.") + " " + round1(ref.appearance.weight) + " pt");
            } else {
                parts.push(t("Contour: aucun", "Stroke: none"));
            }
            refInfo.text = parts.join("\n");
        } else {
            rbRef.enabled = false;
            rbMan.value = true;
            var noRef = gSrc.add("statictext", undefined,
                t("Aucune sélection utilisable : critères manuels uniquement.",
                  "No usable selection: manual criteria only."),
                { multiline: true });
            noRef.characters = 50;
        }

        // Options de correspondance
        var gMatch = dlg.add("panel", undefined, t("Correspondances", "Match"));
        gMatch.orientation = "column";
        gMatch.alignChildren = ["left", "top"];
        gMatch.margins = 10;

        var cbFill = gMatch.add("checkbox", undefined, t("Fond (couleur)", "Fill (color)"));
        var cbStroke = gMatch.add("checkbox", undefined, t("Contour (couleur)", "Stroke (color)"));
        var cbWeight = gMatch.add("checkbox", undefined, t("Épaisseur de contour", "Stroke weight"));
        cbFill.value = true;
        cbStroke.value = true;
        cbWeight.value = false;

        // Critères manuels (couleur Hex RVB simplifiée + épaisseur)
        var gMan = dlg.add("panel", undefined, t("Valeurs manuelles (si mode Manuel)", "Manual values (Manual mode)"));
        gMan.orientation = "column";
        gMan.alignChildren = ["fill", "top"];
        gMan.margins = 10;

        var rowFill = gMan.add("group");
        rowFill.add("statictext", undefined, t("Fond R,V,B (0–255) :", "Fill R,G,B (0–255):"));
        var etFillR = rowFill.add("edittext", undefined, "0"); etFillR.characters = 4;
        var etFillG = rowFill.add("edittext", undefined, "0"); etFillG.characters = 4;
        var etFillB = rowFill.add("edittext", undefined, "0"); etFillB.characters = 4;
        var cbFillNone = gMan.add("checkbox", undefined, t("Aucun fond", "No fill"));

        var rowStroke = gMan.add("group");
        rowStroke.add("statictext", undefined, t("Contour R,V,B :", "Stroke R,G,B:"));
        var etStrokeR = rowStroke.add("edittext", undefined, "0"); etStrokeR.characters = 4;
        var etStrokeG = rowStroke.add("edittext", undefined, "0"); etStrokeG.characters = 4;
        var etStrokeB = rowStroke.add("edittext", undefined, "0"); etStrokeB.characters = 4;
        var cbStrokeNone = gMan.add("checkbox", undefined, t("Aucun contour", "No stroke"));

        var rowW = gMan.add("group");
        rowW.add("statictext", undefined, t("Épaisseur (pt) :", "Weight (pt):"));
        var etWeight = rowW.add("edittext", undefined, "1"); etWeight.characters = 6;

        // Tolérances
        var gTol = dlg.add("panel", undefined, t("Tolérances", "Tolerances"));
        gTol.orientation = "column";
        gTol.alignChildren = ["left", "top"];
        gTol.margins = 10;

        var rowTolC = gTol.add("group");
        rowTolC.add("statictext", undefined, t("Couleur (Δ canaux) :", "Color (channel Δ):"));
        var etTolC = rowTolC.add("edittext", undefined, "2"); etTolC.characters = 5;

        var rowTolW = gTol.add("group");
        rowTolW.add("statictext", undefined, t("Épaisseur (pt) :", "Weight (pt):"));
        var etTolW = rowTolW.add("edittext", undefined, "0.1"); etTolW.characters = 5;

        // Portée
        var gScope = dlg.add("panel", undefined, t("Portée", "Scope"));
        gScope.orientation = "column";
        gScope.alignChildren = ["left", "top"];
        gScope.margins = 10;

        var rbDoc = gScope.add("radiobutton", undefined, t("Document entier", "Entire document"));
        var rbLayer = gScope.add("radiobutton", undefined, t("Calque actif (+ sous-calques)", "Active layer (+ sublayers)"));
        rbDoc.value = true;
        var cbLocked = gScope.add("checkbox", undefined,
            t("Inclure verrouillés / masqués", "Include locked / hidden"));
        cbLocked.value = false;

        // Résultat analyse
        var gRes = dlg.add("panel", undefined, t("Résultat", "Result"));
        gRes.orientation = "column";
        gRes.alignChildren = ["fill", "top"];
        gRes.margins = 10;
        var stRes = gRes.add("statictext", undefined,
            t("Cliquez sur Analyser pour compter les correspondances.",
              "Click Analyze to count matches."),
            { multiline: true });
        stRes.characters = 52;

        // Boutons
        var gBtn = dlg.add("group");
        gBtn.alignment = ["fill", "bottom"];
        gBtn.alignChildren = ["fill", "center"];
        var btnAnalyze = gBtn.add("button", undefined, t("Analyser", "Analyze"));
        var btnSelect = gBtn.add("button", undefined, t("Sélectionner", "Select"));
        var btnCancel = gBtn.add("button", undefined, t("Annuler", "Cancel"), { name: "cancel" });

        function parseNum(et, fallback) {
            var v = parseFloat(String(et.text).replace(",", "."));
            if (isNaN(v)) return fallback;
            return v;
        }

        function parseChannel(et) {
            return clamp(Math.round(parseNum(et, 0)), 0, 255);
        }

        function buildCriteria() {
            var useRef = rbRef.value && ref;
            var crit = {
                matchFill: cbFill.value,
                matchStroke: cbStroke.value,
                matchWeight: cbWeight.value,
                requireFill: true,
                requireStroke: true,
                fillKey: null,
                strokeKey: null,
                weight: 1,
                colorTol: clamp(parseNum(etTolC, 2), 0, 255),
                weightTol: clamp(parseNum(etTolW, 0.1), 0, 100)
            };

            if (!crit.matchFill && !crit.matchStroke && !crit.matchWeight) {
                return { error: t("Cochez au moins un critère (fond, contour ou épaisseur).",
                                  "Check at least one criterion (fill, stroke or weight).") };
            }

            if (useRef) {
                var a = ref.appearance;
                if (crit.matchFill) {
                    crit.requireFill = a.hasFill;
                    crit.fillKey = a.fill;
                }
                if (crit.matchStroke) {
                    crit.requireStroke = a.hasStroke;
                    crit.strokeKey = a.stroke;
                }
                if (crit.matchWeight) {
                    if (!a.hasStroke) {
                        return { error: t("La référence n'a pas de contour : décochez l'épaisseur ou choisissez un autre objet.",
                                          "Reference has no stroke: uncheck weight or pick another object.") };
                    }
                    crit.weight = a.weight;
                }
            } else {
                if (crit.matchFill) {
                    if (cbFillNone.value) {
                        crit.requireFill = false;
                        crit.fillKey = null;
                    } else {
                        crit.requireFill = true;
                        crit.fillKey = ["RGB", parseChannel(etFillR), parseChannel(etFillG), parseChannel(etFillB), 0];
                    }
                }
                if (crit.matchStroke) {
                    if (cbStrokeNone.value) {
                        crit.requireStroke = false;
                        crit.strokeKey = null;
                    } else {
                        crit.requireStroke = true;
                        crit.strokeKey = ["RGB", parseChannel(etStrokeR), parseChannel(etStrokeG), parseChannel(etStrokeB), 0];
                    }
                }
                if (crit.matchWeight) {
                    crit.weight = clamp(parseNum(etWeight, 1), 0, 1000);
                }
            }

            return { crit: crit };
        }

        var lastMatched = null;

        btnAnalyze.onClick = function () {
            var built = buildCriteria();
            if (built.error) {
                alert(built.error);
                return;
            }
            var result = findMatches(built.crit, rbLayer.value, cbLocked.value);
            lastMatched = result.matched;
            stRes.text = t(
                "Parcourus : " + result.total + " · Correspondances : " + result.matched.length +
                "\n(aucune sélection modifiée)",
                "Scanned: " + result.total + " · Matches: " + result.matched.length +
                "\n(selection unchanged)"
            );
        };

        btnSelect.onClick = function () {
            var built = buildCriteria();
            if (built.error) {
                alert(built.error);
                return;
            }
            var result = findMatches(built.crit, rbLayer.value, cbLocked.value);
            lastMatched = result.matched;

            if (result.matched.length === 0) {
                alert(t("Aucune correspondance trouvée.", "No matches found."));
                stRes.text = t("Parcourus : " + result.total + " · Correspondances : 0",
                               "Scanned: " + result.total + " · Matches: 0");
                return;
            }

            beginUndo(t("Sélection par apparence", "Select by Appearance"));
            selectItems(result.matched);
            endUndo();

            stRes.text = t(
                "Sélectionnés : " + result.matched.length + " / " + result.total + " parcourus.",
                "Selected: " + result.matched.length + " / " + result.total + " scanned."
            );
            dlg.close(1);
        };

        btnCancel.onClick = function () { dlg.close(0); };

        dlg.center();
        return dlg;
    }

    function round1(n) {
        return Math.round(Number(n) * 10) / 10;
    }

    function formatKey(key) {
        if (!key) return t("aucun", "none");
        if (key[0] === "RGB") {
            return "RGB(" + Math.round(key[1]) + "," + Math.round(key[2]) + "," + Math.round(key[3]) + ")";
        }
        if (key[0] === "CMYK") {
            return "CMYK(" + round1(key[1]) + "," + round1(key[2]) + "," + round1(key[3]) + "," + round1(key[4]) + ")";
        }
        if (key[0] === "GRAY") {
            return "Gray(" + round1(key[1]) + ")";
        }
        if (key[0] === "SPOT") {
            return "Spot(" + key[1] + " " + round1(key[2]) + "%)";
        }
        return String(key[0]);
    }

    var dialog = buildDialog();
    dialog.show();

})();
