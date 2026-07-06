// ===== STATE =====
const state = { currentPage: 'dashboard', ofs: [], articles: [], etapes: [], encours: [] };

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  await Promise.all([loadEtapes(), loadArticles()]);
  await loadDashboard();
  populateArticleSelect();
  populateEtapeFilters();
});

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;
  pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  state.currentPage = page;
  const titles = { dashboard: 'Tableau de bord', kanban: 'Suivi Kanban', ordres: 'Ordres de fabrication', encours: 'Encours en production', mouvements: 'Historique des mouvements', articles: 'Référentiel articles', dossiers: 'Dossiers Techniques' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (page === 'dashboard') loadDashboard();
  if (page === 'kanban') loadKanban();
  if (page === 'ordres') loadOFs();
  if (page === 'encours') loadEncours();
  if (page === 'mouvements') loadMouvements();
  if (page === 'articles') loadArticles().then(renderArticles);
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.add('hidden'); });
});

function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString('fr-FR'); }

function prioriteBadge(p) {
  const labels = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: '🔴 Urgente' };
  return `<span class="badge prio-${p}">${labels[p] || p}</span>`;
}

function statutBadge(s) {
  const labels = { planifie: 'Planifié', en_cours: 'En cours', suspendu: 'Suspendu', termine: 'Terminé', annule: 'Annulé', en_attente: 'En attente' };
  return `<span class="badge statut-${s}">${labels[s] || s}</span>`;
}

function progressBar(pct) {
  const cls = pct >= 100 ? 'success' : pct >= 60 ? '' : pct >= 30 ? 'warning' : 'danger';
  return `<div style="display:flex;align-items:center;gap:8px"><div class="progress-bar-wrap" style="min-width:80px"><div class="progress-bar-fill ${cls}" style="width:${Math.min(pct||0,100)}%"></div></div><span style="font-size:0.8rem;font-weight:600">${pct||0}%</span></div>`;
}

function joursRestants(d) {
  const diff = Math.round((new Date(d) - new Date()) / 86400000);
  if (diff < 0) return `<span class="text-danger fw-bold">Retard ${Math.abs(diff)}j</span>`;
  if (diff === 0) return `<span class="text-warning fw-bold">Aujourd'hui</span>`;
  if (diff <= 3) return `<span class="text-warning fw-bold">J-${diff}</span>`;
  return `<span class="text-muted">J-${diff}</span>`;
}

async function loadEtapes() { state.etapes = await api('GET', '/dashboard/etapes'); }
async function loadArticles() { state.articles = await api('GET', '/articles'); return state.articles; }

function populateArticleSelect() {
  const sel = document.getElementById('of_article_id');
  sel.innerHTML = '<option value="">Sélectionner un article...</option>';
  state.articles.forEach(a => { sel.innerHTML += `<option value="${a.id}">[${a.reference}] ${a.designation}</option>`; });
}

function populateEtapeFilters() {
  const sel = document.getElementById('filterEtape');
  state.etapes.forEach(e => { sel.innerHTML += `<option value="${e.id}">${e.nom}</option>`; });
  const sd = document.getElementById('mvt_etape_depart');
  const sa = document.getElementById('mvt_etape_arrivee');
  state.etapes.forEach(e => { sd.innerHTML += `<option value="${e.id}">${e.nom}</option>`; sa.innerHTML += `<option value="${e.id}">${e.nom}</option>`; });
}

// DASHBOARD
async function loadDashboard() {
  const data = await api('GET', '/dashboard');
  const { kpis, chargeParEtape, ofsUrgents, mouvementsRecents, alertes } = data;
  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">OFs en cours</div><div class="kpi-value">${kpis.ofs_en_cours}</div><div class="kpi-sub">${kpis.ofs_planifies} planifié(s)</div></div>
    <div class="kpi-card danger"><div class="kpi-label">OFs en retard</div><div class="kpi-value text-danger">${kpis.ofs_en_retard}</div><div class="kpi-sub">sur ${kpis.ofs_en_cours} en cours</div></div>
    <div class="kpi-card success"><div class="kpi-label">OFs terminés</div><div class="kpi-value text-success">${kpis.ofs_termines}</div></div>
    <div class="kpi-card info"><div class="kpi-label">Pièces en cours</div><div class="kpi-value">${kpis.total_pieces_en_cours.toLocaleString('fr-FR')}</div><div class="kpi-sub">dans tous les postes</div></div>
    <div class="kpi-card warning"><div class="kpi-label">Taux de rebut</div><div class="kpi-value ${kpis.taux_rebut > 5 ? 'text-danger' : ''}">${kpis.taux_rebut}%</div><div class="kpi-sub">${kpis.total_rebuts} pièces</div></div>`;
  const maxCharge = Math.max(...chargeParEtape.map(e => e.quantite_en_cours), 1);
  document.getElementById('chargeGrid').innerHTML = chargeParEtape.map(e => {
    const pct = Math.round(100 * e.quantite_en_cours / maxCharge);
    return `<div class="charge-row"><div class="charge-label">${e.nom}</div><div class="charge-bar-wrap"><div class="charge-bar" style="width:${pct||4}%;background:${e.couleur}">${e.quantite_en_cours > 0 ? `<span class="charge-bar-text">${e.quantite_en_cours}</span>` : ''}</div></div><div class="charge-count">${e.nb_ofs} OF${e.nb_ofs !== 1 ? 's' : ''}</div></div>`;
  }).join('');
  document.getElementById('alertCount').textContent = alertes.length;
  document.getElementById('alertsList').innerHTML = alertes.length === 0
    ? '<div class="text-muted" style="text-align:center;padding:24px">✅ Aucune alerte active</div>'
    : alertes.map(a => `<div class="alert-item ${a.niveau}"><span class="alert-icon">${a.niveau==='danger'?'🔴':a.niveau==='warning'?'⚠️':'ℹ️'}</span><div class="alert-content"><div class="alert-msg">${a.message}</div><div class="alert-meta">${a.numero_of||''} ${a.etape_nom?'· '+a.etape_nom:''}</div></div><button class="alert-dismiss" onclick="dismissAlert(${a.id})">✕</button></div>`).join('');
  document.getElementById('urgentsTbody').innerHTML = ofsUrgents.length === 0
    ? `<tr><td colspan="8" class="table-empty">Aucun OF urgent</td></tr>`
    : ofsUrgents.map(of => `<tr><td><strong>${of.numero_of}</strong></td><td>${of.article_designation}</td><td style="color:var(--muted)">${of.client||'-'}</td><td>${prioriteBadge(of.priorite)}</td><td>${formatDate(of.date_livraison_prevue)}</td><td>${of.etape_actuelle?`<span class="badge badge-primary">${of.etape_actuelle}</span>`:'-'}</td><td>${joursRestants(of.date_livraison_prevue)}</td><td><button class="btn btn-outline btn-sm" onclick="showDetailOF(${of.id})">Voir</button></td></tr>`).join('');
  state.recentMouvements = mouvementsRecents;
}

async function dismissAlert(id) { await api('PATCH', `/dashboard/alertes/${id}/acquitter`); loadDashboard(); }

// KANBAN
async function loadKanban() {
  const etapes = await api('GET', '/encours/kanban');
  document.getElementById('kanbanBoard').innerHTML = etapes.map(etape => `
    <div class="kanban-column">
      <div class="kanban-col-header" style="background:${etape.couleur}"><span>${etape.nom}</span><span class="badge">${etape.nb_ofs}</span></div>
      <div class="kanban-col-body">${etape.ofs.length === 0 ? '<div style="text-align:center;color:#aaa;font-size:0.75rem;padding:16px">Aucun OF</div>' : etape.ofs.map(of => `<div class="kanban-card ${of.en_retard?'retard':''} ${of.priorite==='urgente'?'urgente':''}" onclick="showDetailOF(${of.of_id})"><div class="of-num">${of.numero_of} ${of.en_retard?'🔴':''}</div><div class="article">${of.article_designation}</div><div style="display:flex;justify-content:space-between;margin-top:6px"><span class="qty">⚙️ ${of.quantite_en_cours} pcs</span>${prioriteBadge(of.priorite)}</div><div class="date">📅 ${formatDate(of.date_livraison_prevue)}</div></div>`).join('')}</div>
      <div class="kanban-col-footer">${etape.total_en_cours > 0 ? etape.total_en_cours + ' pièces' : 'Vide'}</div>
    </div>`).join('');
}

// OFs
async function loadOFs() { state.ofs = await api('GET', '/ordres'); renderOFs(state.ofs); populateOFSelect(); }

function populateOFSelect() {
  const sel = document.getElementById('mvt_of_id');
  sel.innerHTML = '<option value="">Sélectionner un OF...</option>';
  state.ofs.filter(o => o.statut === 'en_cours').forEach(o => { sel.innerHTML += `<option value="${o.id}">${o.numero_of} - ${o.article_designation}</option>`; });
}

function renderOFs(ofs) {
  document.getElementById('ofsTbody').innerHTML = ofs.length === 0
    ? `<tr><td colspan="10" class="table-empty">Aucun OF trouvé</td></tr>`
    : ofs.map(of => `<tr><td><strong>${of.numero_of}</strong></td><td><div>${of.article_designation}</div><div style="font-size:0.75rem;color:var(--muted)">${of.article_ref} · ${of.categorie}</div></td><td>${of.client||'-'}</td><td>${(of.quantite_lancee||0).toLocaleString('fr-FR')}</td><td>${prioriteBadge(of.priorite)}</td><td>${statutBadge(of.statut)}</td><td>${formatDate(of.date_livraison_prevue)} ${of.en_retard?'<span class="text-danger">⚠</span>':''}</td><td>${progressBar(of.avancement_pct)}</td><td>${of.total_rebut>0?`<span class="text-danger">${of.total_rebut}</span>`:'0'}</td><td><div style="display:flex;gap:4px"><button class="btn btn-outline btn-sm" onclick="showDetailOF(${of.id})">Voir</button><button class="btn btn-outline btn-sm" onclick="editOF(${of.id})">✏️</button></div></td></tr>`).join('');
}

function filterOFs() {
  const search = document.getElementById('searchOF').value.toLowerCase();
  const statut = document.getElementById('filterStatut').value;
  const priorite = document.getElementById('filterPriorite').value;
  renderOFs(state.ofs.filter(of => (!search || of.numero_of.toLowerCase().includes(search) || of.article_designation.toLowerCase().includes(search) || (of.client||'').toLowerCase().includes(search)) && (!statut || of.statut === statut) && (!priorite || of.priorite === priorite)));
}

async function showDetailOF(id) {
  const of = await api('GET', `/ordres/${id}`);
  document.getElementById('detailOFTitle').textContent = `OF ${of.numero_of}`;
  const stepsHtml = of.encours.map(enc => `<div class="of-step ${enc.statut==='en_cours'?'active':enc.statut==='termine'?'done':''}"><div class="of-step-num">Étape ${enc.etape_ordre}</div><div class="of-step-name">${enc.etape_nom}</div><div class="of-step-qty">${enc.quantite_en_cours}</div><div style="font-size:0.65rem">${statutBadge(enc.statut)}</div></div>`).join('');
  const mvtHtml = of.mouvements.slice(0,8).map(m => `<tr><td style="color:var(--muted);font-size:0.75rem">${new Date(m.created_at).toLocaleString('fr-FR')}</td><td>${mvtTypeBadge(m.type_mouvement)}</td><td>${m.etape_depart_nom||'-'} → ${m.etape_arrivee_nom||'-'}</td><td><strong>${m.quantite}</strong></td><td style="color:var(--muted)">${m.operateur||'-'}</td></tr>`).join('');
  document.getElementById('detailOFBody').innerHTML = `<div class="d-flex align-center gap-2 mb-4" style="flex-wrap:wrap">${prioriteBadge(of.priorite)} ${statutBadge(of.statut)}<span style="color:var(--muted);font-size:0.875rem">Client: ${of.client||'-'}</span><span style="color:var(--muted);font-size:0.875rem">Livraison: ${formatDate(of.date_livraison_prevue)}</span></div><div class="form-grid mb-4" style="font-size:0.875rem"><div><strong>Article:</strong> [${of.article_ref}] ${of.article_designation}</div><div><strong>Lancé le:</strong> ${formatDate(of.date_lancement)}</div><div><strong>Qté commandée:</strong> ${of.quantite_commandee}</div><div><strong>Qté lancée:</strong> ${of.quantite_lancee}</div></div><h4 style="margin-bottom:8px;font-size:0.875rem;color:var(--muted)">FLUX DE PRODUCTION</h4><div class="of-steps mb-6">${stepsHtml||'<div class="text-muted">Aucun encours</div>'}</div><h4 style="margin-bottom:8px;font-size:0.875rem;color:var(--muted)">DERNIERS MOUVEMENTS</h4><div class="table-wrapper"><table><thead><tr><th>Date</th><th>Type</th><th>Mouvement</th><th>Qté</th><th>Opérateur</th></tr></thead><tbody>${mvtHtml||'<tr><td colspan="5" class="table-empty">Aucun mouvement</td></tr>'}</tbody></table></div>`;
  document.getElementById('detailOFEditBtn').onclick = () => { closeModal('modalDetailOF'); editOF(id); };
  document.getElementById('modalDetailOF').classList.remove('hidden');
}

function mvtTypeBadge(t) {
  const map = { entree: ['badge-success','Entrée'], transfert: ['badge-primary','Transfert'], sortie: ['badge-info','Sortie'], rebut: ['badge-danger','Rebut'], correction: ['badge-secondary','Correction'] };
  const [cls, label] = map[t] || ['badge-secondary', t];
  return `<span class="badge ${cls}">${label}</span>`;
}

function openNewOF() {
  document.getElementById('of_id').value = '';
  document.getElementById('formOF').reset();
  document.getElementById('of_numero_of').disabled = false;
  document.getElementById('of_date_lancement').value = new Date().toISOString().split('T')[0];
  document.getElementById('modalOFTitle').textContent = 'Nouvel ordre de fabrication';
  document.getElementById('modalOF').classList.remove('hidden');
}

async function editOF(id) {
  if (!state.ofs.length) await loadOFs();
  const of = state.ofs.find(o => o.id === id) || await api('GET', `/ordres/${id}`);
  document.getElementById('of_id').value = id;
  document.getElementById('of_numero_of').value = of.numero_of;
  document.getElementById('of_numero_of').disabled = true;
  document.getElementById('of_article_id').value = of.article_id;
  document.getElementById('of_quantite').value = of.quantite_lancee;
  document.getElementById('of_priorite').value = of.priorite;
  document.getElementById('of_statut').value = of.statut;
  document.getElementById('of_date_lancement').value = of.date_lancement;
  document.getElementById('of_date_livraison').value = of.date_livraison_prevue;
  document.getElementById('of_client').value = of.client || '';
  document.getElementById('of_observations').value = of.observations || '';
  document.getElementById('modalOFTitle').textContent = `Modifier ${of.numero_of}`;
  document.getElementById('modalOF').classList.remove('hidden');
}

async function saveOF() {
  const id = document.getElementById('of_id').value;
  const body = { numero_of: document.getElementById('of_numero_of').value, article_id: document.getElementById('of_article_id').value, quantite_commandee: +document.getElementById('of_quantite').value, quantite_lancee: +document.getElementById('of_quantite').value, priorite: document.getElementById('of_priorite').value, statut: document.getElementById('of_statut').value, date_lancement: document.getElementById('of_date_lancement').value, date_livraison_prevue: document.getElementById('of_date_livraison').value, client: document.getElementById('of_client').value, observations: document.getElementById('of_observations').value };
  try {
    if (id) { await api('PUT', `/ordres/${id}`, body); toast('OF mis à jour'); }
    else { await api('POST', '/ordres', body); toast('OF créé'); }
    closeModal('modalOF');
    document.getElementById('of_numero_of').disabled = false;
    if (state.currentPage === 'ordres') loadOFs();
    else if (state.currentPage === 'dashboard') loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

// ENCOURS
async function loadEncours() {
  const etape = document.getElementById('filterEtape').value;
  const statut = document.getElementById('filterStatutEnc').value;
  let url = '/encours?';
  if (etape) url += `etape_id=${etape}&`;
  if (statut) url += `statut=${statut}`;
  state.encours = await api('GET', url);
  document.getElementById('encoursTbody').innerHTML = state.encours.length === 0
    ? `<tr><td colspan="10" class="table-empty">Aucun encours trouvé</td></tr>`
    : state.encours.map(enc => `<tr><td><strong>${enc.numero_of}</strong></td><td><div style="font-size:0.8rem">${enc.article_designation}</div><div style="font-size:0.7rem;color:var(--muted)">${enc.article_ref}</div></td><td><span class="badge" style="background:${enc.couleur}1a;color:${enc.couleur}">${enc.etape_nom}</span></td><td>${enc.quantite_entree}</td><td><strong>${enc.quantite_en_cours}</strong></td><td>${enc.quantite_sortie}</td><td>${enc.quantite_rebut>0?`<span class="text-danger">${enc.quantite_rebut}</span>`:'0'}</td><td>${enc.operateur||'-'}</td><td>${statutBadge(enc.statut)}</td><td><button class="btn btn-outline btn-sm" onclick="openMouvementModal(${enc.of_id})">Mouvement</button></td></tr>`).join('');
}

// MOUVEMENTS
async function loadMouvements() {
  if (!state.ofs.length) await loadOFs();
  const data = await api('GET', '/dashboard');
  document.getElementById('mvtTbody').innerHTML = data.mouvementsRecents.length === 0
    ? `<tr><td colspan="9" class="table-empty">Aucun mouvement</td></tr>`
    : data.mouvementsRecents.map(m => `<tr><td style="font-size:0.75rem">${new Date(m.created_at).toLocaleString('fr-FR')}</td><td><strong>${m.numero_of}</strong></td><td style="font-size:0.8rem">${m.article_designation}</td><td>${mvtTypeBadge(m.type_mouvement)}</td><td>${m.etape_depart_nom||'-'}</td><td>${m.etape_arrivee_nom||'-'}</td><td><strong>${m.quantite}</strong></td><td>${m.operateur||'-'}</td><td style="color:var(--muted);font-size:0.8rem">${m.notes||'-'}</td></tr>`).join('');
}

// MOUVEMENT MODAL
async function openMouvementModal(preselectedOFId = null) {
  if (!state.ofs.length) await loadOFs();
  document.getElementById('formMouvement').reset();
  if (preselectedOFId) document.getElementById('mvt_of_id').value = preselectedOFId;
  toggleMvtFields();
  document.getElementById('modalMouvement').classList.remove('hidden');
}

function toggleMvtFields() {
  const type = document.getElementById('mvt_type').value;
  document.getElementById('mvtDepartWrap').style.display = type === 'entree' ? 'none' : '';
  document.getElementById('mvtArriveeWrap').style.display = (type === 'rebut' || type === 'sortie') ? 'none' : '';
  document.getElementById('mvtRebutWrap').style.display = type === 'transfert' ? '' : 'none';
}

async function saveMouvement() {
  const of_id = document.getElementById('mvt_of_id').value;
  const type = document.getElementById('mvt_type').value;
  const depart = document.getElementById('mvt_etape_depart').value;
  const arrivee = document.getElementById('mvt_etape_arrivee').value;
  const quantite = +document.getElementById('mvt_quantite').value;
  const rebut = +document.getElementById('mvt_rebut').value || 0;
  if (!of_id || !quantite) return toast('Veuillez remplir les champs obligatoires', 'error');
  try {
    await api('POST', '/encours/mouvement', { of_id: +of_id, type_mouvement: type, etape_depart_id: depart ? +depart : null, etape_arrivee_id: arrivee ? +arrivee : null, quantite, quantite_rebut: rebut, operateur: document.getElementById('mvt_operateur').value, notes: document.getElementById('mvt_notes').value });
    toast('Mouvement enregistré');
    closeModal('modalMouvement');
    if (state.currentPage === 'kanban') loadKanban();
    else if (state.currentPage === 'encours') loadEncours();
    else if (state.currentPage === 'dashboard') loadDashboard();
    else if (state.currentPage === 'mouvements') loadMouvements();
  } catch (e) { toast(e.message, 'error'); }
}

// ARTICLES
function renderArticles(articles) {
  document.getElementById('articlesTbody').innerHTML = articles.length === 0
    ? `<tr><td colspan="6" class="table-empty">Aucun article</td></tr>`
    : articles.map(a => `<tr><td><strong>${a.reference}</strong></td><td>${a.designation}</td><td><span class="badge badge-secondary">${a.categorie}</span></td><td>${a.unite}</td><td>${a.nb_ofs_actifs>0?`<span class="badge badge-primary">${a.nb_ofs_actifs} OF(s)</span>`:'-'}</td><td><div style="display:flex;gap:4px"><button class="btn btn-outline btn-sm" onclick="editArticle(${a.id})">✏️</button><button class="btn btn-outline btn-sm text-danger" onclick="deleteArticle(${a.id},'${a.reference}')">🗑️</button></div></td></tr>`).join('');
}

function filterArticles() {
  const search = document.getElementById('searchArticle').value.toLowerCase();
  renderArticles(state.articles.filter(a => !search || a.reference.toLowerCase().includes(search) || a.designation.toLowerCase().includes(search) || a.categorie.toLowerCase().includes(search)));
}

function openArticleModal() {
  document.getElementById('article_id').value = '';
  document.getElementById('formArticle').reset();
  document.getElementById('article_reference').disabled = false;
  document.getElementById('modalArticleTitle').textContent = 'Nouvel article';
  document.getElementById('modalArticle').classList.remove('hidden');
}

function editArticle(id) {
  const a = state.articles.find(x => x.id === id);
  if (!a) return;
  document.getElementById('article_id').value = a.id;
  document.getElementById('article_reference').value = a.reference;
  document.getElementById('article_reference').disabled = true;
  document.getElementById('article_designation').value = a.designation;
  document.getElementById('article_categorie').value = a.categorie;
  document.getElementById('article_unite').value = a.unite;
  document.getElementById('article_description').value = a.description || '';
  document.getElementById('modalArticleTitle').textContent = 'Modifier article';
  document.getElementById('modalArticle').classList.remove('hidden');
}

async function saveArticle() {
  const id = document.getElementById('article_id').value;
  const body = { reference: document.getElementById('article_reference').value, designation: document.getElementById('article_designation').value, categorie: document.getElementById('article_categorie').value, unite: document.getElementById('article_unite').value, description: document.getElementById('article_description').value };
  try {
    if (id) { await api('PUT', `/articles/${id}`, body); toast('Article mis à jour'); }
    else { await api('POST', '/articles', body); toast('Article créé'); }
    closeModal('modalArticle');
    document.getElementById('article_reference').disabled = false;
    await loadArticles(); renderArticles(state.articles); populateArticleSelect();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteArticle(id, ref) {
  if (!confirm(`Supprimer l'article ${ref} ?`)) return;
  try { await api('DELETE', `/articles/${id}`); toast('Article supprimé'); await loadArticles(); renderArticles(state.articles); }
  catch (e) { toast(e.message, 'error'); }
}
