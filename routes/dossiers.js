const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT dt.*, a.reference as article_ref, a.designation as article_designation, a.categorie,
    (SELECT COUNT(*) FROM dt_nomenclature WHERE dossier_id=dt.id) as nb_matieres,
    (SELECT COUNT(*) FROM dt_variantes WHERE dossier_id=dt.id) as nb_variantes,
    (SELECT COUNT(*) FROM dt_gamme WHERE dossier_id=dt.id) as nb_operations,
    (SELECT COUNT(*) FROM dt_suivi WHERE dossier_id=dt.id) as nb_commentaires
    FROM dossiers_techniques dt JOIN articles a ON dt.article_id=a.id ORDER BY dt.updated_at DESC`).all());
});

router.get('/articles-sans-dossier', (req, res) => {
  res.json(db.prepare('SELECT * FROM articles WHERE id NOT IN (SELECT article_id FROM dossiers_techniques) ORDER BY designation').all());
});

router.post('/', (req, res) => {
  const { article_id, version = '1.0', redacteur } = req.body;
  if (!article_id) return res.status(400).json({ error: 'article_id requis' });
  try {
    const r = db.prepare('INSERT INTO dossiers_techniques (article_id,version,statut,redacteur) VALUES (?,?,"brouillon",?)').run(article_id, version, redacteur);
    db.prepare('INSERT INTO dt_prix_revient (dossier_id) VALUES (?)').run(r.lastInsertRowid);
    db.prepare('INSERT INTO dt_mesures_config (dossier_id,echelle,taille_base) VALUES (?,?,?)').run(r.lastInsertRowid, 'S,M,L,XL', 'M');
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Un dossier existe déjà pour cet article' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const { version, statut, redacteur, valideur, date_validation, observations } = req.body;
  db.prepare('UPDATE dossiers_techniques SET version=?,statut=?,redacteur=?,valideur=?,date_validation=?,observations=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(version, statut, redacteur, valideur, date_validation, observations, req.params.id);
  res.json({ message: 'ok' });
});

router.get('/:id', (req, res) => {
  const dt = db.prepare('SELECT dt.*, a.reference as article_ref, a.designation as article_designation, a.categorie, a.unite FROM dossiers_techniques dt JOIN articles a ON dt.article_id=a.id WHERE dt.id=?').get(req.params.id);
  if (!dt) return res.status(404).json({ error: 'Dossier non trouvé' });
  const variantes = db.prepare('SELECT * FROM dt_variantes WHERE dossier_id=? ORDER BY code').all(dt.id)
    .map(v => ({ ...v, pieces: db.prepare('SELECT * FROM dt_pieces WHERE variante_id=? ORDER BY ordre').all(v.id) }));
  res.json({
    ...dt,
    nomenclature: db.prepare('SELECT * FROM dt_nomenclature WHERE dossier_id=? ORDER BY ordre').all(dt.id),
    variantes,
    gamme: db.prepare('SELECT * FROM dt_gamme WHERE dossier_id=? ORDER BY ordre').all(dt.id),
    placement: db.prepare('SELECT * FROM dt_placement WHERE dossier_id=?').all(dt.id),
    mesures_config: db.prepare('SELECT * FROM dt_mesures_config WHERE dossier_id=?').get(dt.id),
    mesures_lignes: db.prepare('SELECT * FROM dt_mesures_lignes WHERE dossier_id=? ORDER BY ordre').all(dt.id),
    qualite: db.prepare('SELECT * FROM dt_qualite WHERE dossier_id=? ORDER BY ordre').all(dt.id),
    prix_revient: db.prepare('SELECT * FROM dt_prix_revient WHERE dossier_id=?').get(dt.id),
    suivi: db.prepare('SELECT * FROM dt_suivi WHERE dossier_id=? ORDER BY created_at DESC').all(dt.id),
  });
});

// NOMENCLATURE
router.post('/:id/nomenclature', (req, res) => {
  const f = req.body;
  if (!f.designation) return res.status(400).json({ error: 'designation requise' });
  const r = db.prepare('INSERT INTO dt_nomenclature (dossier_id,ordre,reference_matiere,designation,type_matiere,unite,quantite_par_piece,laize,perte_percent,fournisseur,reference_fournisseur,prix_unitaire,devise,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.params.id, f.ordre||0, f.reference_matiere, f.designation, f.type_matiere||'tissu', f.unite||'m', f.quantite_par_piece||0, f.laize, f.perte_percent||10, f.fournisseur, f.reference_fournisseur, f.prix_unitaire||0, f.devise||'EUR', f.notes);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/nomenclature/:nid', (req, res) => {
  const f = req.body;
  db.prepare('UPDATE dt_nomenclature SET ordre=?,reference_matiere=?,designation=?,type_matiere=?,unite=?,quantite_par_piece=?,laize=?,perte_percent=?,fournisseur=?,reference_fournisseur=?,prix_unitaire=?,devise=?,notes=? WHERE id=? AND dossier_id=?')
    .run(f.ordre, f.reference_matiere, f.designation, f.type_matiere, f.unite, f.quantite_par_piece, f.laize, f.perte_percent, f.fournisseur, f.reference_fournisseur, f.prix_unitaire, f.devise, f.notes, req.params.nid, req.params.id);
  res.json({ message: 'ok' });
});
router.delete('/:id/nomenclature/:nid', (req, res) => { db.prepare('DELETE FROM dt_nomenclature WHERE id=? AND dossier_id=?').run(req.params.nid, req.params.id); res.json({ message: 'ok' }); });

// VARIANTES
router.post('/:id/variantes', (req, res) => {
  const { code, designation, description, couleur, tailles } = req.body;
  if (!code || !designation) return res.status(400).json({ error: 'code et designation requis' });
  const r = db.prepare('INSERT INTO dt_variantes (dossier_id,code,designation,description,couleur,tailles) VALUES (?,?,?,?,?,?)').run(req.params.id, code, designation, description, couleur, JSON.stringify(tailles||[]));
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/variantes/:vid', (req, res) => {
  const { code, designation, description, couleur, tailles } = req.body;
  db.prepare('UPDATE dt_variantes SET code=?,designation=?,description=?,couleur=?,tailles=? WHERE id=? AND dossier_id=?').run(code, designation, description, couleur, JSON.stringify(tailles||[]), req.params.vid, req.params.id);
  res.json({ message: 'ok' });
});
router.delete('/:id/variantes/:vid', (req, res) => { db.prepare('DELETE FROM dt_variantes WHERE id=? AND dossier_id=?').run(req.params.vid, req.params.id); res.json({ message: 'ok' }); });

// PIÈCES
router.post('/:id/variantes/:vid/pieces', (req, res) => {
  const f = req.body;
  if (!f.designation) return res.status(400).json({ error: 'designation requise' });
  const r = db.prepare('INSERT INTO dt_pieces (variante_id,ordre,reference,designation,quantite,matiere_ref,sens_droit,sens_travers,sens_biais,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.params.vid, f.ordre||0, f.reference, f.designation, f.quantite||1, f.matiere_ref, f.sens_droit?1:0, f.sens_travers?1:0, f.sens_biais?1:0, f.notes);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/variantes/:vid/pieces/:pid', (req, res) => {
  const f = req.body;
  db.prepare('UPDATE dt_pieces SET ordre=?,reference=?,designation=?,quantite=?,matiere_ref=?,sens_droit=?,sens_travers=?,sens_biais=?,notes=? WHERE id=? AND variante_id=?')
    .run(f.ordre, f.reference, f.designation, f.quantite, f.matiere_ref, f.sens_droit?1:0, f.sens_travers?1:0, f.sens_biais?1:0, f.notes, req.params.pid, req.params.vid);
  res.json({ message: 'ok' });
});
router.delete('/:id/variantes/:vid/pieces/:pid', (req, res) => { db.prepare('DELETE FROM dt_pieces WHERE id=? AND variante_id=?').run(req.params.pid, req.params.vid); res.json({ message: 'ok' }); });

// GAMME
router.post('/:id/gamme', (req, res) => {
  const f = req.body;
  if (!f.designation) return res.status(400).json({ error: 'designation requise' });
  const r = db.prepare('INSERT INTO dt_gamme (dossier_id,ordre,code_operation,designation,poste,type_machine,temps_standard,unite_temps,taux_horaire,description,points_cles) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.params.id, f.ordre||0, f.code_operation, f.designation, f.poste, f.type_machine, f.temps_standard||0, f.unite_temps||'min', f.taux_horaire||0, f.description, f.points_cles);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/gamme/:gid', (req, res) => {
  const f = req.body;
  db.prepare('UPDATE dt_gamme SET ordre=?,code_operation=?,designation=?,poste=?,type_machine=?,temps_standard=?,unite_temps=?,taux_horaire=?,description=?,points_cles=? WHERE id=? AND dossier_id=?')
    .run(f.ordre, f.code_operation, f.designation, f.poste, f.type_machine, f.temps_standard, f.unite_temps, f.taux_horaire, f.description, f.points_cles, req.params.gid, req.params.id);
  res.json({ message: 'ok' });
});
router.delete('/:id/gamme/:gid', (req, res) => { db.prepare('DELETE FROM dt_gamme WHERE id=? AND dossier_id=?').run(req.params.gid, req.params.id); res.json({ message: 'ok' }); });

// PLACEMENT
router.post('/:id/placement', (req, res) => {
  const f = req.body;
  if (!f.designation) return res.status(400).json({ error: 'designation requise' });
  const r = db.prepare('INSERT INTO dt_placement (dossier_id,reference,designation,laize,longueur_matelas,nb_epaisseurs,nb_poses,rendement,sens,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.params.id, f.reference, f.designation, f.laize, f.longueur_matelas, f.nb_epaisseurs||1, f.nb_poses||1, f.rendement, f.sens||'unidirectionnel', f.notes);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/placement/:pid', (req, res) => {
  const f = req.body;
  db.prepare('UPDATE dt_placement SET reference=?,designation=?,laize=?,longueur_matelas=?,nb_epaisseurs=?,nb_poses=?,rendement=?,sens=?,notes=? WHERE id=? AND dossier_id=?')
    .run(f.reference, f.designation, f.laize, f.longueur_matelas, f.nb_epaisseurs, f.nb_poses, f.rendement, f.sens, f.notes, req.params.pid, req.params.id);
  res.json({ message: 'ok' });
});
router.delete('/:id/placement/:pid', (req, res) => { db.prepare('DELETE FROM dt_placement WHERE id=? AND dossier_id=?').run(req.params.pid, req.params.id); res.json({ message: 'ok' }); });

// MESURES
router.put('/:id/mesures/config', (req, res) => {
  const { echelle, taille_base } = req.body;
  db.prepare('INSERT INTO dt_mesures_config (dossier_id,echelle,taille_base) VALUES (?,?,?) ON CONFLICT(dossier_id) DO UPDATE SET echelle=excluded.echelle,taille_base=excluded.taille_base').run(req.params.id, echelle, taille_base);
  res.json({ message: 'ok' });
});
router.post('/:id/mesures', (req, res) => {
  const { ordre, point_mesure, valeurs, tolerance_plus, tolerance_moins, methode } = req.body;
  if (!point_mesure) return res.status(400).json({ error: 'point_mesure requis' });
  const r = db.prepare('INSERT INTO dt_mesures_lignes (dossier_id,ordre,point_mesure,valeurs,tolerance_plus,tolerance_moins,methode) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id, ordre||0, point_mesure, typeof valeurs==='object' ? JSON.stringify(valeurs) : (valeurs||'{}'), tolerance_plus||1, tolerance_moins||1, methode);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/mesures/:mid', (req, res) => {
  const f = req.body;
  db.prepare('UPDATE dt_mesures_lignes SET ordre=?,point_mesure=?,valeurs=?,tolerance_plus=?,tolerance_moins=?,methode=? WHERE id=? AND dossier_id=?')
    .run(f.ordre, f.point_mesure, typeof f.valeurs==='object' ? JSON.stringify(f.valeurs) : f.valeurs, f.tolerance_plus, f.tolerance_moins, f.methode, req.params.mid, req.params.id);
  res.json({ message: 'ok' });
});
router.delete('/:id/mesures/:mid', (req, res) => { db.prepare('DELETE FROM dt_mesures_lignes WHERE id=? AND dossier_id=?').run(req.params.mid, req.params.id); res.json({ message: 'ok' }); });

// QUALITÉ
router.post('/:id/qualite', (req, res) => {
  const f = req.body;
  if (!f.critere) return res.status(400).json({ error: 'critere requis' });
  const r = db.prepare('INSERT INTO dt_qualite (dossier_id,ordre,critere,specification,valeur_attendue,tolerance,methode_controle,frequence,niveau_acceptation,gravite) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.params.id, f.ordre||0, f.critere, f.specification, f.valeur_attendue, f.tolerance, f.methode_controle, f.frequence||'100%', f.niveau_acceptation||'AQL 2.5', f.gravite||'majeur');
  res.status(201).json({ id: r.lastInsertRowid });
});
router.put('/:id/qualite/:qid', (req, res) => {
  const f = req.body;
  db.prepare('UPDATE dt_qualite SET ordre=?,critere=?,specification=?,valeur_attendue=?,tolerance=?,methode_controle=?,frequence=?,niveau_acceptation=?,gravite=? WHERE id=? AND dossier_id=?')
    .run(f.ordre, f.critere, f.specification, f.valeur_attendue, f.tolerance, f.methode_controle, f.frequence, f.niveau_acceptation, f.gravite, req.params.qid, req.params.id);
  res.json({ message: 'ok' });
});
router.delete('/:id/qualite/:qid', (req, res) => { db.prepare('DELETE FROM dt_qualite WHERE id=? AND dossier_id=?').run(req.params.qid, req.params.id); res.json({ message: 'ok' }); });

// PRIX DE REVIENT
router.put('/:id/prix-revient', (req, res) => {
  const f = req.body;
  db.prepare('INSERT INTO dt_prix_revient (dossier_id,taux_horaire_mo,taux_charges,frais_fixes,frais_transport,frais_divers,marge_percent,devise,notes) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(dossier_id) DO UPDATE SET taux_horaire_mo=excluded.taux_horaire_mo,taux_charges=excluded.taux_charges,frais_fixes=excluded.frais_fixes,frais_transport=excluded.frais_transport,frais_divers=excluded.frais_divers,marge_percent=excluded.marge_percent,devise=excluded.devise,notes=excluded.notes')
    .run(req.params.id, f.taux_horaire_mo, f.taux_charges, f.frais_fixes, f.frais_transport, f.frais_divers, f.marge_percent, f.devise||'EUR', f.notes);
  res.json({ message: 'ok' });
});

router.get('/:id/prix-revient/calcul', (req, res) => {
  const cfg = db.prepare('SELECT * FROM dt_prix_revient WHERE dossier_id=?').get(req.params.id);
  if (!cfg) return res.status(404).json({ error: 'Configuration prix non trouvée' });
  const matieres = db.prepare('SELECT * FROM dt_nomenclature WHERE dossier_id=?').all(req.params.id);
  const cout_matieres = matieres.reduce((s, m) => s + m.quantite_par_piece * (1 + (m.perte_percent||0)/100) * (m.prix_unitaire||0), 0);
  const gamme = db.prepare('SELECT * FROM dt_gamme WHERE dossier_id=?').all(req.params.id);
  const temps_total_min = gamme.reduce((s, g) => s + (g.temps_standard||0), 0);
  const cout_mo_base = (temps_total_min / 60) * (cfg.taux_horaire_mo||12);
  const cout_mo_avec_charges = cout_mo_base * (1 + (cfg.taux_charges||0)/100);
  const frais = (cfg.frais_fixes||0) + (cfg.frais_transport||0) + (cfg.frais_divers||0);
  const cout_total_revient = cout_matieres + cout_mo_avec_charges + frais;
  const prix_vente_ht = cout_total_revient / (1 - (cfg.marge_percent||0)/100);
  res.json({
    config: cfg, matieres_detail: matieres,
    cout_matieres: Math.round(cout_matieres*1000)/1000,
    temps_total_min: Math.round(temps_total_min*10)/10,
    cout_mo_base: Math.round(cout_mo_base*1000)/1000,
    cout_mo_avec_charges: Math.round(cout_mo_avec_charges*1000)/1000,
    frais_annexes: Math.round(frais*1000)/1000,
    cout_total_revient: Math.round(cout_total_revient*1000)/1000,
    marge_brute: Math.round((prix_vente_ht - cout_total_revient)*1000)/1000,
    prix_vente_ht: Math.round(prix_vente_ht*1000)/1000,
    devise: cfg.devise||'EUR'
  });
});

// SUIVI
router.post('/:id/suivi', (req, res) => {
  const { type, auteur, contenu } = req.body;
  if (!auteur || !contenu) return res.status(400).json({ error: 'auteur et contenu requis' });
  const r = db.prepare('INSERT INTO dt_suivi (dossier_id,type,auteur,contenu) VALUES (?,?,?,?)').run(req.params.id, type||'commentaire', auteur, contenu);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.delete('/:id/suivi/:sid', (req, res) => { db.prepare('DELETE FROM dt_suivi WHERE id=? AND dossier_id=?').run(req.params.sid, req.params.id); res.json({ message: 'ok' }); });

module.exports = router;
