const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'textile.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      designation TEXT NOT NULL,
      categorie TEXT NOT NULL,
      unite TEXT DEFAULT 'pcs',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS etapes_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      ordre INTEGER NOT NULL,
      couleur TEXT DEFAULT '#6c757d',
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS ordres_fabrication (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_of TEXT UNIQUE NOT NULL,
      article_id INTEGER NOT NULL,
      quantite_commandee INTEGER NOT NULL,
      quantite_lancee INTEGER DEFAULT 0,
      client TEXT,
      date_lancement DATE NOT NULL,
      date_livraison_prevue DATE NOT NULL,
      priorite TEXT DEFAULT 'normale' CHECK(priorite IN ('basse','normale','haute','urgente')),
      statut TEXT DEFAULT 'en_cours' CHECK(statut IN ('planifie','en_cours','suspendu','termine','annule')),
      observations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );
    CREATE TABLE IF NOT EXISTS encours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      of_id INTEGER NOT NULL,
      etape_id INTEGER NOT NULL,
      quantite_entree INTEGER DEFAULT 0,
      quantite_en_cours INTEGER DEFAULT 0,
      quantite_sortie INTEGER DEFAULT 0,
      quantite_rebut INTEGER DEFAULT 0,
      date_debut DATETIME,
      date_fin_prevue DATE,
      operateur TEXT,
      machine TEXT,
      statut TEXT DEFAULT 'en_attente' CHECK(statut IN ('en_attente','en_cours','termine','suspendu')),
      observations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (of_id) REFERENCES ordres_fabrication(id),
      FOREIGN KEY (etape_id) REFERENCES etapes_production(id),
      UNIQUE(of_id, etape_id)
    );
    CREATE TABLE IF NOT EXISTS mouvements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      of_id INTEGER NOT NULL,
      etape_depart_id INTEGER,
      etape_arrivee_id INTEGER,
      quantite INTEGER NOT NULL,
      type_mouvement TEXT NOT NULL CHECK(type_mouvement IN ('entree','transfert','sortie','rebut','correction')),
      operateur TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (of_id) REFERENCES ordres_fabrication(id),
      FOREIGN KEY (etape_depart_id) REFERENCES etapes_production(id),
      FOREIGN KEY (etape_arrivee_id) REFERENCES etapes_production(id)
    );
    CREATE TABLE IF NOT EXISTS alertes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('retard','blocage','rebut_eleve','capacite')),
      of_id INTEGER,
      etape_id INTEGER,
      message TEXT NOT NULL,
      niveau TEXT DEFAULT 'warning' CHECK(niveau IN ('info','warning','danger')),
      acquittee INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (of_id) REFERENCES ordres_fabrication(id),
      FOREIGN KEY (etape_id) REFERENCES etapes_production(id)
    );

    -- DOSSIERS TECHNIQUES
    CREATE TABLE IF NOT EXISTS dossiers_techniques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL UNIQUE,
      version TEXT DEFAULT '1.0',
      statut TEXT DEFAULT 'brouillon' CHECK(statut IN ('brouillon','en_revision','valide','archive')),
      redacteur TEXT, valideur TEXT, date_validation DATE, observations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );
    CREATE TABLE IF NOT EXISTS dt_nomenclature (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      ordre INTEGER DEFAULT 0,
      reference_matiere TEXT, designation TEXT NOT NULL,
      type_matiere TEXT DEFAULT 'tissu' CHECK(type_matiere IN ('tissu','doublure','entoilage','fil','bouton','fermeture','etiquette','emballage','autre')),
      unite TEXT DEFAULT 'm',
      quantite_par_piece REAL DEFAULT 0, laize REAL, perte_percent REAL DEFAULT 10,
      fournisseur TEXT, reference_fournisseur TEXT,
      prix_unitaire REAL DEFAULT 0, devise TEXT DEFAULT 'EUR', notes TEXT,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_variantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      code TEXT NOT NULL, designation TEXT NOT NULL,
      description TEXT, couleur TEXT, tailles TEXT DEFAULT '[]', actif INTEGER DEFAULT 1,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variante_id INTEGER NOT NULL,
      ordre INTEGER DEFAULT 0, reference TEXT, designation TEXT NOT NULL,
      quantite INTEGER DEFAULT 1, matiere_ref TEXT,
      sens_droit INTEGER DEFAULT 1, sens_travers INTEGER DEFAULT 0, sens_biais INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (variante_id) REFERENCES dt_variantes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_gamme (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      ordre INTEGER DEFAULT 0, code_operation TEXT, designation TEXT NOT NULL,
      poste TEXT, type_machine TEXT,
      temps_standard REAL DEFAULT 0, unite_temps TEXT DEFAULT 'min',
      taux_horaire REAL DEFAULT 0, description TEXT, points_cles TEXT,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_placement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      reference TEXT, designation TEXT NOT NULL,
      laize REAL, longueur_matelas REAL,
      nb_epaisseurs INTEGER DEFAULT 1, nb_poses INTEGER DEFAULT 1,
      rendement REAL,
      sens TEXT DEFAULT 'unidirectionnel' CHECK(sens IN ('unidirectionnel','bidirectionnel','en_retourne')),
      notes TEXT,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_mesures_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL UNIQUE,
      echelle TEXT DEFAULT 'S,M,L,XL',
      taille_base TEXT DEFAULT 'M',
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_mesures_lignes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      ordre INTEGER DEFAULT 0, point_mesure TEXT NOT NULL,
      valeurs TEXT DEFAULT '{}',
      tolerance_plus REAL DEFAULT 1, tolerance_moins REAL DEFAULT 1, methode TEXT,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_qualite (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      ordre INTEGER DEFAULT 0, critere TEXT NOT NULL,
      specification TEXT, valeur_attendue TEXT, tolerance TEXT,
      methode_controle TEXT, frequence TEXT DEFAULT '100%',
      niveau_acceptation TEXT DEFAULT 'AQL 2.5',
      gravite TEXT DEFAULT 'majeur' CHECK(gravite IN ('critique','majeur','mineur')),
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_prix_revient (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL UNIQUE,
      taux_horaire_mo REAL DEFAULT 12, taux_charges REAL DEFAULT 45,
      frais_fixes REAL DEFAULT 0, frais_transport REAL DEFAULT 0, frais_divers REAL DEFAULT 0,
      marge_percent REAL DEFAULT 30, devise TEXT DEFAULT 'EUR', notes TEXT,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS dt_suivi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id INTEGER NOT NULL,
      type TEXT DEFAULT 'commentaire' CHECK(type IN ('commentaire','modification','validation','alerte')),
      auteur TEXT NOT NULL, contenu TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dossier_id) REFERENCES dossiers_techniques(id) ON DELETE CASCADE
    );
  `);

  const etapesCount = db.prepare('SELECT COUNT(*) as c FROM etapes_production').get();
  if (etapesCount.c === 0) {
    const ins = db.prepare('INSERT INTO etapes_production (code,nom,ordre,couleur,description) VALUES (?,?,?,?,?)');
    [['COUPE','Coupe',1,'#e74c3c','Découpe des matières premières'],
     ['PREP','Préparation',2,'#e67e22','Préparation et assemblage des pièces'],
     ['COUTURE','Couture / Montage',3,'#3498db','Assemblage et couture des pièces'],
     ['BRODERIE','Broderie / Impression',4,'#9b59b6','Broderie et finitions graphiques'],
     ['FINITION','Finition',5,'#1abc9c','Repassage, boutonnage et finitions'],
     ['CQ','Contrôle Qualité',6,'#f39c12','Contrôle et inspection qualité'],
     ['CONDITIONNEMENT','Conditionnement',7,'#27ae60','Pliage, emballage et conditionnement'],
     ['EXPEDITION','Expédition',8,'#2c3e50','Préparation et expédition']
    ].forEach(e => ins.run(...e));
  }

  const artCount = db.prepare('SELECT COUNT(*) as c FROM articles').get();
  if (artCount.c === 0) seedDemoData();
}

function seedDemoData() {
  const insA = db.prepare('INSERT INTO articles (reference,designation,categorie,unite,description) VALUES (?,?,?,?,?)');
  [['ART-001','Chemise homme classique blanche','Chemiserie','pcs','Chemise 100% coton, col classique'],
   ['ART-002','Pantalon chino beige','Pantalonnerie','pcs','Pantalon en coton stretch'],
   ['ART-003','Robe été fleurie','Robes','pcs','Robe légère en polyester imprimé'],
   ['ART-004','Veste blazer marine','Vestes','pcs','Blazer doublé, 2 boutons'],
   ['ART-005','T-shirt basique col rond','T-shirts','pcs','T-shirt 100% coton biologique']
  ].forEach(a => insA.run(...a));

  const insOF = db.prepare('INSERT INTO ordres_fabrication (numero_of,article_id,quantite_commandee,quantite_lancee,client,date_lancement,date_livraison_prevue,priorite,statut) VALUES (?,?,?,?,?,?,?,?,?)');
  [['OF-2024-001',1,500,500,'Mode & Co','2024-03-01','2024-03-25','urgente','en_cours'],
   ['OF-2024-002',2,300,300,'BelVêtement','2024-03-05','2024-03-28','haute','en_cours'],
   ['OF-2024-003',3,200,200,'Style Factory','2024-03-10','2024-04-05','normale','en_cours'],
   ['OF-2024-004',4,150,100,'Luxe Textile','2024-03-12','2024-04-10','haute','en_cours'],
   ['OF-2024-005',5,1000,1000,'GrandStock','2024-03-15','2024-04-01','normale','en_cours'],
   ['OF-2024-006',1,250,250,'Mode & Co','2024-02-20','2024-03-20','normale','termine']
  ].forEach(o => insOF.run(...o));

  const insE = db.prepare('INSERT INTO encours (of_id,etape_id,quantite_entree,quantite_en_cours,quantite_sortie,quantite_rebut,date_debut,operateur,machine,statut) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insE.run(1,1,500,0,500,5,'2024-03-01','Marie D.','COUPE-01','termine');
  insE.run(1,2,495,0,495,0,'2024-03-03','Jean P.',null,'termine');
  insE.run(1,3,495,0,480,15,'2024-03-06','Fatima B.','MACH-03','termine');
  insE.run(1,5,480,0,480,0,'2024-03-15','Sophie L.',null,'termine');
  insE.run(1,6,480,120,360,8,'2024-03-20','Ahmed K.',null,'en_cours');
  insE.run(2,1,300,0,300,2,'2024-03-05','Marie D.','COUPE-02','termine');
  insE.run(2,2,298,0,298,0,'2024-03-07','Jean P.',null,'termine');
  insE.run(2,3,298,180,118,5,'2024-03-10','Karim S.','MACH-01','en_cours');
  insE.run(3,1,200,0,200,3,'2024-03-10','Marie D.','COUPE-01','termine');
  insE.run(3,2,197,197,0,0,'2024-03-13','Lina M.',null,'en_cours');
  insE.run(4,1,100,60,40,0,'2024-03-12','Paul T.','COUPE-03','en_cours');
  insE.run(5,1,1000,0,1000,8,'2024-03-15','Marie D.','COUPE-01','termine');
  insE.run(5,2,992,0,992,0,'2024-03-17','Jean P.',null,'termine');
  insE.run(5,3,992,550,442,12,'2024-03-19','Fatima B.','MACH-02','en_cours');

  const insM = db.prepare('INSERT INTO mouvements (of_id,etape_depart_id,etape_arrivee_id,quantite,type_mouvement,operateur,notes) VALUES (?,?,?,?,?,?,?)');
  insM.run(1,null,1,500,'entree','Marie D.','Lancement OF-2024-001');
  insM.run(1,1,2,495,'transfert','Marie D.','Fin de coupe');
  insM.run(1,2,3,495,'transfert','Jean P.','Passage en couture');
  insM.run(2,null,1,300,'entree','Marie D.','Lancement OF-2024-002');
  insM.run(5,null,1,1000,'entree','Marie D.','Lancement OF-2024-005');

  // DOSSIER TECHNIQUE - ART-001
  const did = db.prepare('INSERT INTO dossiers_techniques (article_id,version,statut,redacteur,valideur,date_validation,observations) VALUES (?,?,?,?,?,?,?)').run(1,'2.1','valide','Sophie Martin','Directeur Technique','2024-02-15','Dossier validé PE 2024. Révision col en v2.1.').lastInsertRowid;

  const insN = db.prepare('INSERT INTO dt_nomenclature (dossier_id,ordre,reference_matiere,designation,type_matiere,unite,quantite_par_piece,laize,perte_percent,fournisseur,reference_fournisseur,prix_unitaire) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  insN.run(did,1,'TIS-COT-001','Popeline coton blanc 100%','tissu','m',1.85,150,12,'Tissage du Nord','TN-POP-BL',4.20);
  insN.run(did,2,'TIS-COT-002','Entretoise col thermocollant','entoilage','m',0.25,90,8,'Interflex','IF-THC-90',1.80);
  insN.run(did,3,'FIL-POL-001','Fil polyester blanc 120/2','fil','m',180,null,5,'FilPro','FP-POL-120-BL',0.008);
  insN.run(did,4,'BTN-001','Bouton nacre 4 trous Ø12mm','bouton','pcs',8,null,2,'BoutonMaster','BM-NAC-12',0.18);
  insN.run(did,5,'ETQ-001','Étiquette composition/entretien','etiquette','pcs',1,null,0,'LabelPrint','LP-COMP',0.05);
  insN.run(did,6,'EMB-001','Sachet polybag 30x40cm','emballage','pcs',1,null,0,'PackFrance','PF-POL-3040',0.12);

  const v1 = db.prepare('INSERT INTO dt_variantes (dossier_id,code,designation,description,couleur,tailles) VALUES (?,?,?,?,?,?)').run(did,'CHM-BL','Blanc standard','Col classique','#FFFFFF','["S","M","L","XL","XXL"]').lastInsertRowid;
  db.prepare('INSERT INTO dt_variantes (dossier_id,code,designation,description,couleur,tailles) VALUES (?,?,?,?,?,?)').run(did,'CHM-BL-CC','Blanc col boutonné','Button-down','#F5F5F5','["S","M","L","XL","XXL"]');

  const insP = db.prepare('INSERT INTO dt_pieces (variante_id,ordre,reference,designation,quantite,matiere_ref,sens_droit,sens_travers,sens_biais) VALUES (?,?,?,?,?,?,?,?,?)');
  [['P-DEV-AV','Devant avant (x2)',2,'TIS-COT-001',1,0,0],['P-DOS','Dos principal',1,'TIS-COT-001',1,0,0],
   ['P-MAN-G','Manche gauche',1,'TIS-COT-001',1,0,0],['P-MAN-D','Manche droite',1,'TIS-COT-001',1,0,0],
   ['P-COL','Col',1,'TIS-COT-001',1,0,0],['P-COL-ENT','Entoilage col',1,'TIS-COT-002',1,0,0],
   ['P-POIG-G','Poignet gauche',1,'TIS-COT-001',1,0,0],['P-POIG-D','Poignet droit',1,'TIS-COT-001',1,0,0],
   ['P-PATT-BT','Patte de boutonnage',1,'TIS-COT-001',1,0,0]
  ].forEach((p,i) => insP.run(v1,i+1,...p));

  const insG = db.prepare('INSERT INTO dt_gamme (dossier_id,ordre,code_operation,designation,poste,type_machine,temps_standard,taux_horaire,description,points_cles) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insG.run(did,1,'G-010','Thermocollage entoilages col','Préparation','Presse thermocollante',2.5,12,'Thermocollage col à 160°C, 15 sec','Contrôler adhérence');
  insG.run(did,2,'G-020','Assemblage épaules','Couture','Machine plate 301',3.0,12,'Coudre épaules dos/devant, surjeter','Repère côté dos + court');
  insG.run(did,3,'G-030','Montage col','Couture','Machine plate 301',5.5,12,'Monter le col sur l\'encolure','Vérifier symétrie');
  insG.run(did,4,'G-040','Montage manches','Couture','Machine plate 301',6.0,12,'Monter les manches, vérifier ampleur','Repère centre épaule');
  insG.run(did,5,'G-050','Fermeture côtés et manches','Couture','Surjeteuse 3 fils',4.5,12,'Fermeture côté en une seule couture','Alignement poignet/bas');
  insG.run(did,6,'G-060','Montage poignets','Couture','Machine plate 301',4.0,12,'Monter les poignets sur les manches','Largeur poignet = 6.5 cm');
  insG.run(did,7,'G-070','Boutonnière et pose boutons','Finition','Boutonnière auto',5.0,12,'8 boutonnières + 2 poignets','Espacement 7.5 cm');
  insG.run(did,8,'G-080','Repassage / finishing','Finition','Mannequin vapeur',3.5,12,'Repassage complet sur mannequin','Col droit, pas de faux-plis');
  insG.run(did,9,'G-090','Contrôle et conditionnement','Contrôle Qualité',null,3.0,12,'Contrôle visuel 100%','Check-list 12 points');

  const insPl = db.prepare('INSERT INTO dt_placement (dossier_id,reference,designation,laize,longueur_matelas,nb_epaisseurs,nb_poses,rendement,sens) VALUES (?,?,?,?,?,?,?,?,?)');
  insPl.run(did,'PL-CHM-BL-M','Placement taille M - Popeline',150,185,40,40,78.5,'unidirectionnel');
  insPl.run(did,'PL-CHM-ENT','Placement entoilage col/poignets',90,55,80,80,62.0,'bidirectionnel');

  db.prepare('INSERT INTO dt_mesures_config (dossier_id,echelle,taille_base) VALUES (?,?,?)').run(did,'S,M,L,XL,XXL','M');
  const insMes = db.prepare('INSERT INTO dt_mesures_lignes (dossier_id,ordre,point_mesure,valeurs,tolerance_plus,tolerance_moins,methode) VALUES (?,?,?,?,?,?,?)');
  insMes.run(did,1,'Longueur totale (épaule→bas)','{"S":73,"M":76,"L":79,"XL":82,"XXL":85}',1,1,'À plat, milieu dos');
  insMes.run(did,2,'Tour de poitrine (×2)','{"S":50,"M":53,"L":56,"XL":60,"XXL":64}',1.5,1.5,'Sous les emmanchures');
  insMes.run(did,3,'Tour de taille (×2)','{"S":46,"M":49,"L":52,"XL":56,"XXL":60}',1.5,1.5,'Milieu chemise');
  insMes.run(did,4,'Tour de basques (×2)','{"S":48,"M":51,"L":54,"XL":58,"XXL":62}',1.5,1.5,'Bas de chemise');
  insMes.run(did,5,'Longueur manche','{"S":62,"M":64,"L":66,"XL":68,"XXL":70}',1,1,'Couture épaule à plat');
  insMes.run(did,6,'Largeur épaule','{"S":14,"M":15,"L":16,"XL":17,"XXL":18}',0.5,0.5,'Couture à couture');
  insMes.run(did,7,'Hauteur col','{"S":4,"M":4,"L":4,"XL":4,"XXL":4}',0.3,0.3,'Milieu dos');
  insMes.run(did,8,'Largeur poignet','{"S":22,"M":23,"L":24,"XL":25,"XXL":26}',0.5,0.5,'Boutonné à plat');

  const insQ = db.prepare('INSERT INTO dt_qualite (dossier_id,ordre,critere,specification,valeur_attendue,tolerance,methode_controle,frequence,niveau_acceptation,gravite) VALUES (?,?,?,?,?,?,?,?,?,?)');
  insQ.run(did,1,'Solidité couleur au lavage','ISO 105-C06','≥ 4/5',null,'Test lavage 40°C','Par lot','AQL 1.0','critique');
  insQ.run(did,2,'Résistance coutures','ISO 13935-1','≥ 200 N','±10%','Dynamomètre','Hebdomadaire','AQL 2.5','majeur');
  insQ.run(did,3,'Symétrie col',null,'Écart ≤ 2mm',null,'Règle + visuel','100%',null,'majeur');
  insQ.run(did,4,'Boutonnières',null,'L=13mm ±0.5mm',null,'Pied de mesure','100%',null,'majeur');
  insQ.run(did,5,'Défauts tissu','Grille 4 points','0 critique','≤4 pts/100m²','Table lumineuse','100% réception','AQL 1.5','critique');
  insQ.run(did,6,'Repassage (faux-plis)',null,'0 faux-pli visible',null,'Contrôle visuel','100%',null,'mineur');

  db.prepare('INSERT INTO dt_prix_revient (dossier_id,taux_horaire_mo,taux_charges,frais_fixes,frais_transport,frais_divers,marge_percent) VALUES (?,?,?,?,?,?,?)').run(did,13.50,48,0.45,0.30,0.20,35);

  const insSuivi = db.prepare('INSERT INTO dt_suivi (dossier_id,type,auteur,contenu) VALUES (?,?,?,?)');
  insSuivi.run(did,'validation','Sophie Martin','Dossier v2.1 validé. Toutes les mesures conformes au patron.');
  insSuivi.run(did,'modification','Karim S.','Temps montage manche ajusté de 5.5 à 6.0 min après analyse en atelier.');
  insSuivi.run(did,'commentaire','Directeur Technique','Envisager passage en coton/polyester 60/40 pour réduction coût à la prochaine révision.');
}

initDatabase();
module.exports = db;
