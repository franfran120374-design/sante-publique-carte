const API = '';
let map, markers = { etabs: [], profs: [], signals: [], search: [] };
let userLat = 46.603354, userLng = 1.888334;
let selectedType = null;

let notificationsEnabled = false;
let lastCheck = new Date().toISOString();

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initNav();
    initForm();
    initSearch();
    initLayers();
    loadData();
    getUserLocation();
    pollImportStatus();
    initNotifications();
    initAddForms();
    initDetailPanel();
    initFilters();
    document.getElementById('filters-panel').classList.add('open');
});

function initNotifications() {
    const btn = document.getElementById('notif-toggle');
    if (!btn) return;

    notificationsEnabled = localStorage.getItem('notif_enabled') === 'true';
    updateNotifBtn();

    btn.addEventListener('click', async () => {
        if (!notificationsEnabled) {
            if ('Notification' in window) {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    notificationsEnabled = true;
                    localStorage.setItem('notif_enabled', 'true');
                    lastCheck = new Date().toISOString();
                    startNotifPolling();
                }
            } else {
                alert('Notifications non supportées par ce navigateur');
            }
        } else {
            notificationsEnabled = false;
            localStorage.setItem('notif_enabled', 'false');
        }
        updateNotifBtn();
    });

    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        startNotifPolling();
    }
}

function updateNotifBtn() {
    const btn = document.getElementById('notif-toggle');
    if (btn) {
        btn.textContent = notificationsEnabled ? '🔔 ON' : '🔕 OFF';
        btn.style.background = notificationsEnabled ? '#27ae60' : '#95a5a6';
    }
}

let notifInterval = null;
function startNotifPolling() {
    if (notifInterval) clearInterval(notifInterval);
    notifInterval = setInterval(checkNewSignalements, 30000);
}

async function checkNewSignalements() {
    if (!notificationsEnabled) return;
    try {
        const res = await fetch(`${API}/api/signalements/new?since=${encodeURIComponent(lastCheck)}&lat=${userLat}&lng=${userLng}&rayon=100`);
        const newSignals = await res.json();
        if (newSignals.length > 0) {
            lastCheck = new Date().toISOString();
            newSignals.forEach(s => {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Nouveau signalement', {
                        body: `${getTypeLabel(s.type)} — ${s.commune || ''}\n${s.description || ''}`,
                        icon: '/manifest.json'
    });
}

function openDetailPanel(data, type) {
    const panel = document.getElementById('detail-panel');
    const content = document.getElementById('detail-content');

    if (type === 'etablissement') {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
        content.innerHTML = `
            <h2>${escapeHtml(data.nom)}</h2>
            <span class="detail-type-badge" style="background:#3498db">${escapeHtml(data.type || 'Établissement')}</span>

            <div class="detail-section-title">Adresse</div>
            <div class="detail-info-row">
                <span class="detail-info-icon">📍</span>
                <span class="detail-info-text detail-address">
                    ${escapeHtml(data.adresse || '')}<br>
                    ${escapeHtml(data.code_postal || '')} ${escapeHtml(data.commune || '')}
                </span>
            </div>

            ${data.telephone ? `
            <div class="detail-section-title">Contact</div>
            <div class="detail-info-row">
                <span class="detail-info-icon">📞</span>
                <span class="detail-info-text"><a href="tel:${escapeHtml(data.telephone)}" class="detail-phone">${escapeHtml(data.telephone)}</a></span>
            </div>` : ''}

            <div class="detail-section-title">Identifiant</div>
            <div class="detail-info-row">
                <span class="detail-info-icon">🏷️</span>
                <span class="detail-info-text detail-id">FINESS: ${escapeHtml(data.id)}</span>
            </div>

            ${data.departement ? `
            <div class="detail-info-row">
                <span class="detail-info-icon">🗺️</span>
                <span class="detail-info-text">Département: ${escapeHtml(data.departement)}</span>
            </div>` : ''}

            ${data.source === 'user' ? '<span class="detail-source-badge">Ajouté par un citoyen</span>' : ''}

            <a href="${mapsUrl}" target="_blank" rel="noopener" class="detail-maps-btn">📍 Y aller avec Google Maps</a>
        `;
    } else if (type === 'professionnel') {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
        const secteurLabel = data.secteur ? `Secteur ${data.secteur}` : '';
        const cvLabel = data.accepte_carte_vitale ? 'Oui' : 'Non';

        content.innerHTML = `
            <h2>${escapeHtml(data.prenom || '')} ${escapeHtml(data.nom)}</h2>
            <span class="detail-type-badge" style="background:#e67e22">${escapeHtml(data.profession || data.specialite || 'Professionnel')}</span>

            <div class="detail-section-title">Adresse</div>
            <div class="detail-info-row">
                <span class="detail-info-icon">📍</span>
                <span class="detail-info-text detail-address">
                    ${escapeHtml(data.adresse || '')}<br>
                    ${escapeHtml(data.code_postal || '')} ${escapeHtml(data.commune || '')}
                </span>
            </div>

            <div class="detail-section-title">Informations</div>
            ${data.specialite ? `
            <div class="detail-info-row">
                <span class="detail-info-icon">🩺</span>
                <span class="detail-info-text">Spécialité: ${escapeHtml(data.specialite)}</span>
            </div>` : ''}
            ${secteurLabel ? `
            <div class="detail-info-row">
                <span class="detail-info-icon">💰</span>
                <span class="detail-info-text">${secteurLabel}</span>
            </div>` : ''}
            <div class="detail-info-row">
                <span class="detail-info-icon">💳</span>
                <span class="detail-info-text">Carte Vitale: ${cvLabel}</span>
            </div>

            <div class="detail-section-title">Identifiant</div>
            <div class="detail-info-row">
                <span class="detail-info-icon">🏷️</span>
                <span class="detail-info-text detail-id">${escapeHtml(data.id)}</span>
            </div>

            ${data.source === 'user' ? '<span class="detail-source-badge">Ajouté par un citoyen</span>' : ''}

            <a href="${mapsUrl}" target="_blank" rel="noopener" class="detail-maps-btn">📍 Y aller avec Google Maps</a>
        `;
    }

    panel.classList.add('open');
    map.closePopup();
}

function closeDetailPanel() {
    document.getElementById('detail-panel').classList.remove('open');
}

function initDetailPanel() {
    document.getElementById('detail-close').addEventListener('click', closeDetailPanel);
    map.on('click', (e) => {
        if (!pickerMode) closeDetailPanel();
    });
}

function initFilters() {
    document.getElementById('apply-filters').addEventListener('click', applyFilters);
    document.getElementById('filters-reset').addEventListener('click', resetFilters);

    const rayonSlider = document.getElementById('filter-rayon');
    rayonSlider.addEventListener('input', () => {
        document.getElementById('rayon-val').textContent = rayonSlider.value;
    });

    loadDeptList();
}

function loadDeptList() {
    const depts = [
        ['01','Ain','01'],['02','Aisne','02'],['03','Allier','03'],['04','Alpes-de-Haute-Provence','04'],
        ['05','Hautes-Alpes','05'],['06','Alpes-Maritimes','06'],['07','Ardèche','07'],['08','Ardennes','08'],
        ['09','Ariège','09'],['10','Aube','10'],['11','Aude','11'],['12','Aveyron','12'],
        ['13','Bouches-du-Rhône','13'],['14','Calvados','14'],['15','Cantal','15'],['16','Charente','16'],
        ['17','Charente-Maritime','17'],['18','Cher','18'],['19','Corrèze','19'],['2A','Corse-du-Sud','2A'],
        ['2B','Haute-Corse','2B'],['21','Côte-d\'Or','21'],['22','Côtes-d\'Armor','22'],['23','Creuse','23'],
        ['24','Dordogne','24'],['25','Doubs','25'],['26','Drôme','26'],['27','Eure','27'],
        ['28','Eure-et-Loir','28'],['29','Finistère','29'],['30','Gard','30'],['31','Haute-Garonne','31'],
        ['32','Gers','32'],['33','Gironde','33'],['34','Hérault','34'],['35','Ille-et-Vilaine','35'],
        ['36','Indre','36'],['37','Indre-et-Loire','37'],['38','Isère','38'],['39','Jura','39'],
        ['40','Landes','40'],['41','Loir-et-Cher','41'],['42','Loire','42'],['43','Haute-Loire','43'],
        ['44','Loire-Atlantique','44'],['45','Loiret','45'],['46','Lot','46'],['47','Lot-et-Garonne','47'],
        ['48','Lozère','48'],['49','Maine-et-Loire','49'],['50','Manche','50'],['51','Marne','51'],
        ['52','Haute-Marne','52'],['53','Mayenne','53'],['54','Meurthe-et-Moselle','54'],['55','Meuse','55'],
        ['56','Morbihan','56'],['57','Moselle','57'],['58','Nièvre','58'],['59','Nord','59'],
        ['60','Oise','60'],['61','Orne','61'],['62','Pas-de-Calais','62'],['63','Puy-de-Dôme','63'],
        ['64','Pyrénées-Atlantiques','64'],['65','Hautes-Pyrénées','65'],['66','Pyrénées-Orientales','66'],
        ['67','Bas-Rhin','67'],['68','Haut-Rhin','68'],['69','Rhône','69'],['70','Haute-Saône','70'],
        ['71','Saône-et-Loire','71'],['72','Sarthe','72'],['73','Savoie','73'],['74','Haute-Savoie','74'],
        ['75','Paris','75'],['76','Seine-Maritime','76'],['77','Seine-et-Marne','77'],['78','Yvelines','78'],
        ['79','Deux-Sèvres','79'],['80','Somme','80'],['81','Tarn','81'],['82','Tarn-et-Garonne','82'],
        ['83','Var','83'],['84','Vaucluse','84'],['85','Vendée','85'],['86','Vienne','86'],
        ['87','Haute-Vienne','87'],['88','Vosges','88'],['89','Yonne','89'],['90','Territoire de Belfort','90'],
        ['91','Essonne','91'],['92','Hauts-de-Seine','92'],['93','Seine-Saint-Denis','93'],
        ['94','Val-de-Marne','94'],['95','Val-d\'Oise','95']
    ];
    const dl = document.getElementById('dept-list');
    depts.forEach(([code, name]) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} - ${name}`;
        dl.appendChild(opt);
    });
}

async function applyFilters() {
    const dept = document.getElementById('dept-search').value.trim();
    const specialite = document.getElementById('filter-specialite').value;
    const type = document.getElementById('filter-type').value;
    const rayon = document.getElementById('filter-rayon').value;

    let url = `${API}/api/data/etablissements?rayon=${rayon}&limit=5000`;
    let profUrl = `${API}/api/data/professionnels?rayon=${rayon}&limit=5000`;

    if (dept) {
        url += `&departement=${dept}`;
        profUrl += `&departement=${dept}`;
    }
    if (type) url += `&type=${encodeURIComponent(type)}`;
    if (specialite) profUrl += `&profession=${encodeURIComponent(specialite)}`;

    try {
        const [etabsRes, profsRes] = await Promise.all([
            fetch(url),
            fetch(profUrl)
        ]);
        const etabs = await etabsRes.json();
        const profs = await profsRes.json();

        clearMarkers();
        renderEtablissements(etabs);
        renderProfessionnels(profs);

        document.getElementById('count-etabs').textContent = etabs.length;
        document.getElementById('count-profs').textContent = profs.length;

        if (dept && deptsCoords[dept]) {
            map.flyTo([deptsCoords[dept].lat, deptsCoords[dept].lng], 9);
        }
    } catch (err) {
        console.error('Filter error:', err);
    }
}

function resetFilters() {
    document.getElementById('dept-search').value = '';
    document.getElementById('filter-specialite').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-rayon').value = 200;
    document.getElementById('rayon-val').textContent = '200';
    document.getElementById('filter-sect1').checked = true;
    document.getElementById('filter-sect2').checked = true;
    document.getElementById('filter-sect3').checked = true;
    loadData();
}

const deptsCoords = {
    '01':{lat:46.2,lng:5.28},'02':{lat:49.5,lng:3.62},'03':{lat:46.4,lng:3.42},
    '04':{lat:44.09,lng:6.24},'05':{lat:44.66,lng:6.33},'06':{lat:43.71,lng:7.27},
    '07':{lat:44.73,lng:4.60},'08':{lat:49.53,lng:4.58},'09':{lat:42.97,lng:1.61},
    '10':{lat:48.30,lng:4.07},'11':{lat:43.21,lng:2.35},'12':{lat:44.35,lng:2.57},
    '13':{lat:43.30,lng:5.37},'14':{lat:49.18,lng:-0.37},'15':{lat:45.03,lng:2.67},
    '16':{lat:45.65,lng:0.16},'17':{lat:45.84,lng:-1.15},'18':{lat:47.08,lng:1.69},
    '19':{lat:45.27,lng:1.77},'21':{lat:47.32,lng:5.04},'22':{lat:48.52,lng:-2.80},
    '23':{lat:46.17,lng:1.87},'24':{lat:45.18,lng:0.72},'25':{lat:47.24,lng:6.35},
    '26':{lat:44.75,lng:4.89},'27':{lat:49.02,lng:1.15},'28':{lat:48.45,lng:1.49},
    '29':{lat:48.39,lng:-4.49},'30':{lat:43.84,lng:4.36},'31':{lat:43.60,lng:1.44},
    '32':{lat:43.65,lng:0.59},'33':{lat:44.84,lng:-0.58},'34':{lat:43.61,lng:3.88},
    '35':{lat:48.11,lng:-1.68},'36':{lat:46.81,lng:1.60},'37':{lat:47.39,lng:0.68},
    '38':{lat:45.19,lng:5.72},'39':{lat:46.67,lng:5.56},'40':{lat:43.89,lng:-0.50},
    '41':{lat:47.59,lng:1.33},'42':{lat:45.68,lng:4.15},'43':{lat:45.04,lng:3.88},
    '44':{lat:47.22,lng:-1.55},'45':{lat:47.90,lng:1.91},'46':{lat:44.45,lng:1.78},
    '47':{lat:44.20,lng:0.62},'48':{lat:44.52,lng:3.50},'49':{lat:47.47,lng:-0.56},
    '50':{lat:48.89,lng:-1.19},'51':{lat:49.04,lng:3.96},'52':{lat:48.11,lng:5.14},
    '53':{lat:48.07,lng:-0.77},'54':{lat:48.69,lng:6.18},'55':{lat:49.00,lng:5.38},
    '56':{lat:47.76,lng:-2.76},'57':{lat:49.12,lng:6.18},'58':{lat:47.07,lng:3.56},
    '59':{lat:50.63,lng:3.06},'60':{lat:49.42,lng:2.83},'61':{lat:48.43,lng:0.09},
    '62':{lat:50.43,lng:2.83},'63':{lat:45.78,lng:3.09},'64':{lat:43.30,lng:-0.37},
    '65':{lat:43.23,lng:0.08},'66':{lat:42.69,lng:2.90},'67':{lat:48.57,lng:7.75},
    '68':{lat:47.75,lng:7.34},'69':{lat:45.76,lng:4.84},'70':{lat:47.62,lng:6.16},
    '71':{lat:46.58,lng:4.36},'72':{lat:47.99,lng:0.20},'73':{lat:45.57,lng:6.35},
    '74':{lat:46.00,lng:6.14},'75':{lat:48.86,lng:2.35},'76':{lat:49.44,lng:1.10},
    '77':{lat:48.55,lng:2.66},'78':{lat:48.80,lng:2.13},'79':{lat:46.32,lng:-0.46},
    '80':{lat:49.89,lng:2.30},'81':{lat:43.90,lng:2.15},'82':{lat:44.02,lng:1.36},
    '83':{lat:43.52,lng:6.09},'84':{lat:43.94,lng:4.81},'85':{lat:46.67,lng:-1.43},
    '86':{lat:46.58,lng:0.34},'87':{lat:45.83,lng:1.26},'88':{lat:48.17,lng:6.45},
    '89':{lat:47.80,lng:3.57},'90':{lat:47.63,lng:6.86},'91':{lat:48.40,lng:2.24},
    '92':{lat:48.89,lng:2.22},'93':{lat:48.94,lng:2.45},'94':{lat:48.79,lng:2.47},
    '95':{lat:49.05,lng:2.10},'2A':{lat:41.92,lng:8.74},'2B':{lat:42.50,lng:9.25}
};

async function loadAproposStats() {
    try {
        const res = await fetch(`${API}/api/stats/dashboard`);
        const data = await res.json();
        document.getElementById('apro-etabs').textContent = (data.total_etabs || 0).toLocaleString('fr-FR');
        document.getElementById('apro-profs').textContent = (data.total_profs || 0).toLocaleString('fr-FR');
        document.getElementById('apro-signals').textContent = (data.total_signalements || 0).toLocaleString('fr-FR');
        const depts = data.par_departement ? [...new Set(data.par_departement.map(d => d.departement))].length : 0;
        document.getElementById('apro-depts').textContent = depts || '101';
    } catch (e) {}
}
            });
            loadData();
        }
    } catch (e) {}
}

async function pollImportStatus() {
    try {
        const res = await fetch('/api/import-status');
        const status = await res.json();
        if (status.status === 'pending' || status.status === 'running' || status.status === 'starting') {
            showImportBanner(status.message || 'Chargement des données...');
            setTimeout(pollImportStatus, 10000);
        } else if (status.status === 'done') {
            hideImportBanner();
            loadData();
        } else if (status.status === 'error') {
            showImportBanner(status.message || 'Erreur');
            document.getElementById('import-banner').style.background = '#e74c3c';
            document.getElementById('import-banner').style.color = 'white';
        } else {
            hideImportBanner();
        }
    } catch (e) {
        hideImportBanner();
    }
}

function showImportBanner(msg) {
    let banner = document.getElementById('import-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'import-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#000;text-align:center;padding:10px;z-index:10000;font-weight:bold;font-size:14px;';
        document.body.prepend(banner);
    }
    banner.textContent = msg;
    banner.style.display = 'block';
}

function hideImportBanner() {
    const banner = document.getElementById('import-banner');
    if (banner) banner.style.display = 'none';
}

function initMap() {
    map = L.map('map').setView([userLat, userLng], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    map.on('click', (e) => {
        if (document.getElementById('view-signaler').classList.contains('active')) {
            document.getElementById('signal-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('signal-lng').value = e.latlng.lng.toFixed(6);
        }
    });
}

function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');

            const fp = document.getElementById('filters-panel');
            if (view === 'map') {
                fp.classList.add('open');
            } else {
                fp.classList.remove('open');
                closeDetailPanel();
            }

            if (view === 'stats') loadStats();
            if (view === 'apropos') loadAproposStats();
        });
    });
}

function initForm() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedType = btn.dataset.type;

            const dureeGroup = document.getElementById('duree-group');
            dureeGroup.style.display = selectedType === 'attente' ? 'block' : 'none';
        });
    });

    document.getElementById('get-location-btn').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                document.getElementById('signal-lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('signal-lng').value = pos.coords.longitude.toFixed(6);
            });
        }
    });

    document.getElementById('signal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedType) return alert('Selectionnez un type de signal');

        const data = {
            type: selectedType,
            description: document.getElementById('description').value,
            duree_attente_min: document.getElementById('duree').value ? parseInt(document.getElementById('duree').value) : null,
            latitude: parseFloat(document.getElementById('signal-lat').value),
            longitude: parseFloat(document.getElementById('signal-lng').value),
            auteur_pseudo: document.getElementById('pseudo').value || null
        };

        if (!data.latitude || !data.longitude) return alert('Geolocalisez ou cliquez sur la carte');

        try {
            await fetch(`${API}/api/signalements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            alert('Signalement envoye ! Merci.');
            document.getElementById('signal-form').reset();
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
            selectedType = null;
            loadData();
        } catch (err) {
            alert("Erreur d'envoi");
        }
    });
}

function initSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');
    const resultsDiv = document.getElementById('search-results') || createSearchResults();

    const doSearch = async () => {
        const q = input.value.trim();
        if (!q || q.length < 2) return;

        resultsDiv.innerHTML = '<div style="padding:10px;color:#999;">Recherche...</div>';
        resultsDiv.style.display = 'block';

        try {
            const res = await fetch(`${API}/api/data/recherche?q=${encodeURIComponent(q)}&lat=${userLat}&lng=${userLng}&rayon=200`);
            const results = await res.json();

            clearSearchMarkers();

            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="padding:10px;color:#999;">Aucun resultat</div>';
                return;
            }

            let html = `<div style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #eee;">${results.length} resultat(s) pour "${q}"</div>`;

            results.forEach(r => {
                const icon = r.source === 'etablissement' ? '🏥' : '👨‍⚕️';
                const typeBadge = r.categorie ? `<span style="background:${r.source === 'etablissement' ? '#3498db' : '#e67e22'};color:white;padding:1px 6px;border-radius:3px;font-size:10px">${escapeHtml(r.categorie)}</span>` : '';
                const address = r.adresse ? `<br><small style="color:#666">📍 ${escapeHtml(r.adresse)}</small>` : '';
                const phone = r.telephone ? `<br><small style="color:#3498db">📞 ${escapeHtml(r.telephone)}</small>` : '';
                const dept = r.departement ? `<small style="color:#999"> · ${escapeHtml(r.departement)}</small>` : '';

                html += `<div class="search-item" onclick="zoomToResult(${r.latitude},${r.longitude}, '${r.source}', '${escapeHtml(r.id)}')">
                    <span>${icon}</span>
                    <div>
                        <strong>${escapeHtml(r.name || '')}</strong>
                        ${typeBadge}
                        ${address}
                        ${phone}
                        <small>${escapeHtml(r.commune || '')} ${escapeHtml(r.code_postal || '')}${dept}</small>
                    </div>
                </div>`;

                if (r.latitude && r.longitude) {
                    const color = r.source === 'etablissement' ? '#3498db' : '#27ae60';
                    const icon2 = L.divIcon({
                        className: 'custom-marker marker-search',
                        iconSize: [20, 20],
                        html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;">${r.source === 'etablissement' ? 'H' : 'D'}</div>`
                    });
                    const markerData = {
                        nom: r.name, prenom: r.prenom, type: r.categorie, profession: r.categorie,
                        specialite: r.specialite, adresse: r.adresse, code_postal: r.code_postal,
                        commune: r.commune, departement: r.departement, telephone: r.telephone,
                        id: r.id, latitude: r.latitude, longitude: r.longitude,
                        secteur: r.secteur, accepte_carte_vitale: r.accepte_carte_vitale, source: r.source_type
                    };
                    const m = L.marker([r.latitude, r.longitude], { icon: icon2 })
                        .on('click', () => openDetailPanel(markerData, r.source));
                    m.addTo(map);
                    markers.search.push(m);
                }
            });

            resultsDiv.innerHTML = html;

            if (results[0].latitude && results[0].longitude) {
                map.setView([results[0].latitude, results[0].longitude], 13);
            }
        } catch (err) {
            console.error('Search error:', err);
            resultsDiv.innerHTML = '<div style="padding:10px;color:#e74c3c;">Erreur de recherche</div>';
        }
    };

    btn.addEventListener('click', doSearch);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSearch();
    });
}

function createSearchResults() {
    const div = document.createElement('div');
    div.id = 'search-results';
    div.style.cssText = 'position:absolute;top:60px;right:10px;width:300px;max-height:400px;overflow-y:auto;background:white;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:1000;display:none;';
    document.getElementById('map').parentElement.style.position = 'relative';
    document.getElementById('map').parentElement.appendChild(div);
    return div;
}

window.zoomToResult = (lat, lng) => {
    if (lat && lng) map.setView([lat, lng], 15);
};

function clearSearchMarkers() {
    markers.search.forEach(m => map.removeLayer(m));
    markers.search = [];
}

function initLayers() {
    ['etabs', 'profs', 'signals'].forEach(layer => {
        const el = document.getElementById(`layer-${layer}`);
        if (el) {
            el.addEventListener('change', (e) => {
                const visible = e.target.checked;
                markers[layer].forEach(m => {
                    if (visible) m.addTo(map);
                    else map.removeLayer(m);
                });
            });
        }
    });
}

function getUserLocation() {
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    userLat = pos.coords.latitude;
                    userLng = pos.coords.longitude;
                    map.setView([userLat, userLng], 12);
                    loadData();
                });
            }
        });
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            map.setView([userLat, userLng], 6);
            loadData();
        }, () => {
            loadData();
        });
    } else {
        loadData();
    }
}

async function loadData() {
    try {
        const [etabsRes, profsRes, signalsRes] = await Promise.all([
            fetch(`${API}/api/data/etablissements?lat=${userLat}&lng=${userLng}&rayon=500&limit=5000`),
            fetch(`${API}/api/data/professionnels?lat=${userLat}&lng=${userLng}&rayon=500&limit=5000`),
            fetch(`${API}/api/signalements?lat=${userLat}&lng=${userLng}&rayon=500`)
        ]);

        const etabs = await etabsRes.json();
        const profs = await profsRes.json();
        const signals = await signalsRes.json();

        clearMarkers();
        renderEtablissements(etabs);
        renderProfessionnels(profs);
        renderSignalements(signals);

        document.getElementById('count-etabs').textContent = etabs.length;
        document.getElementById('count-profs').textContent = profs.length;
        document.getElementById('count-signals').textContent = signals.length;

    } catch (err) {
        console.error('Load error:', err);
    }
}

function clearMarkers() {
    ['etabs', 'profs', 'signals'].forEach(layer => {
        markers[layer].forEach(m => map.removeLayer(m));
        markers[layer] = [];
    });
}

function renderEtablissements(etabs) {
    const icon = L.divIcon({
        className: 'custom-marker marker-etab',
        iconSize: [10, 10]
    });

    etabs.forEach(e => {
        if (!e.latitude || !e.longitude) return;
        const marker = L.marker([e.latitude, e.longitude], { icon })
            .on('click', () => openDetailPanel(e, 'etablissement'));
        markers.etabs.push(marker);
        if (document.getElementById('layer-etabs') && document.getElementById('layer-etabs').checked) {
            marker.addTo(map);
        }
    });
}

function renderProfessionnels(profs) {
    const icon = L.divIcon({
        className: 'custom-marker marker-prof',
        iconSize: [10, 10]
    });

    profs.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const marker = L.marker([p.latitude, p.longitude], { icon })
            .on('click', () => openDetailPanel(p, 'professionnel'));
        markers.profs.push(marker);
        if (document.getElementById('layer-profs') && document.getElementById('layer-profs').checked) {
            marker.addTo(map);
        }
    });
}

function renderSignalements(signals) {
    signals.forEach(s => {
        const color = s.type === 'attente' ? '#f39c12' :
                      s.type === 'fermeture' ? '#e74c3c' :
                      s.type === 'satisfaction' ? '#27ae60' : '#9b59b6';

        const icon = L.divIcon({
            className: 'custom-marker marker-signal',
            iconSize: [20, 20],
            html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`
        });

        const marker = L.marker([s.latitude, s.longitude], { icon })
            .bindPopup(`
                <strong>${getTypeLabel(s.type)}</strong><br>
                ${escapeHtml(s.description || '')}<br>
                ${s.duree_attente_min ? s.duree_attente_min + ' min' : ''}<br>
                <small>${formatDate(s.date_signalement)} · ${escapeHtml(s.commune || '')}</small><br>
                <small>Par ${escapeHtml(s.auteur_pseudo || 'Anonyme')}</small><br>
                <div style="margin-top:5px;">
                    <button onclick="voteSignal(${s.id}, 'up')" style="padding:3px 8px;border:1px solid #27ae60;border-radius:4px;background:white;cursor:pointer;">+1 ${s.votes_up || 0}</button>
                    <button onclick="voteSignal(${s.id}, 'down')" style="padding:3px 8px;border:1px solid #e74c3c;border-radius:4px;background:white;cursor:pointer;">-1 ${s.votes_down || 0}</button>
                    <button onclick="editSignal(${s.id}, '${escapeHtml((s.description || '').replace(/'/g, "\\'"))}')" style="padding:3px 8px;border:1px solid #3498db;border-radius:4px;background:white;cursor:pointer;">Modifier</button>
                    <button onclick="deleteSignal(${s.id})" style="padding:3px 8px;border:1px solid #e74c3c;border-radius:4px;background:white;color:#e74c3c;cursor:pointer;">Supprimer</button>
                </div>
            `);
        markers.signals.push(marker);
        if (document.getElementById('layer-signals') && document.getElementById('layer-signals').checked) {
            marker.addTo(map);
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getTypeLabel(type) {
    const labels = {
        attente: 'Temps d\'attente',
        fermeture: 'Fermeture',
        satisfaction: 'Satisfaction',
        manque: 'Manque de soins',
        manque_soins: 'Manque de soins'
    };
    return labels[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

window.voteSignal = async (id, vote) => {
    try {
        await fetch(`${API}/api/signalements/${id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote })
        });
        loadData();
    } catch (err) {
        console.error('Vote error:', err);
    }
};

window.editSignal = async (id, currentDesc) => {
    const newDesc = prompt('Modifier la description:', currentDesc);
    if (newDesc === null) return;
    try {
        await fetch(`${API}/api/signalements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: newDesc })
        });
        loadData();
    } catch (err) {
        alert('Erreur de modification');
    }
};

window.deleteSignal = async (id) => {
    if (!confirm('Supprimer ce signalement ?')) return;
    try {
        await fetch(`${API}/api/signalements/${id}`, { method: 'DELETE' });
        loadData();
    } catch (err) {
        alert('Erreur de suppression');
    }
};

async function loadStats() {
    try {
        const res = await fetch(`${API}/api/stats/dashboard`);
        const data = await res.json();

        document.getElementById('stat-etabs').textContent = data.resume.etablissements.toLocaleString();
        document.getElementById('stat-profs').textContent = data.resume.professionnels.toLocaleString();
        document.getElementById('stat-signals').textContent = data.resume.signalements.toLocaleString();

        const avgWait = data.signalements_par_type.find(s => s.type === 'attente');
        document.getElementById('stat-wait').textContent = avgWait ? Math.round(avgWait.duree_moyenne) : '-';

        renderBarChart('chart-types', data.signalements_par_type, 'type', 'total', ['#f39c12', '#e74c3c', '#27ae60', '#9b59b6']);
        renderBarChart('chart-depts', data.top_departements_signalements, 'departement', 'total', ['#3498db']);

        const recentList = document.getElementById('recent-list');
        if (recentList) {
            recentList.innerHTML = data.signalements_recents.map(s => `
                <div class="signal-item">
                    <div class="signal-type-icon ${s.type}">${getTypeIcon(s.type)}</div>
                    <div class="signal-details">
                        <div class="signal-desc">${escapeHtml(s.description || getTypeLabel(s.type))}</div>
                        <div class="signal-meta">${escapeHtml(s.commune || '')} · ${formatDate(s.date_signalement)}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Stats error:', err);
    }
}

function getTypeIcon(type) {
    const icons = { attente: 'Attente', fermeture: 'Ferme', satisfaction: 'Satisfait', manque: 'Manque', manque_soins: 'Manque' };
    return icons[type] || '?';
}

function renderBarChart(containerId, data, labelKey, valueKey, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!data.length) {
        container.innerHTML = '<p class="loading">Aucune donnee</p>';
        return;
    }

    const max = Math.max(...data.map(d => d[valueKey]));
    container.innerHTML = `<div class="bar-chart">${data.slice(0, 10).map((d, i) => `
        <div class="bar-row">
            <div class="bar-label">${escapeHtml(d[labelKey] || 'N/A')}</div>
            <div class="bar-fill" style="width:${(d[valueKey] / max * 100)}%;background:${colors[i % colors.length]}">${d[valueKey]}</div>
        </div>
    `).join('')}</div>`;
}

let pickerMode = null;
let pickerMarker = null;

function initAddForms() {
    document.querySelectorAll('.add-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.add-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.add-form').forEach(f => f.classList.remove('active'));
            document.getElementById(`form-add-${tab.dataset.addTab}`).classList.add('active');
            document.getElementById('add-success').style.display = 'none';
        });
    });

    function setupPicker(btnId, latId, lngId) {
        document.getElementById(btnId).addEventListener('click', () => {
            pickerMode = { latId, lngId };
            document.getElementById('map').classList.add('picker-mode');
            document.getElementById(btnId).textContent = '👆 Cliquez sur la carte';
            document.getElementById(btnId).style.background = '#e74c3c';
        });
    }

    setupPicker('add-etab-locate', 'add-etab-lat', 'add-etab-lng');
    setupPicker('add-prof-locate', 'add-prof-lat', 'add-prof-lng');

    map.on('click', function(e) {
        if (!pickerMode) return;
        const { lat, lng } = e.latlng;
        document.getElementById(pickerMode.latId).value = lat.toFixed(6);
        document.getElementById(pickerMode.lngId).value = lng.toFixed(6);

        if (pickerMarker) map.removeLayer(pickerMarker);
        pickerMarker = L.marker([lat, lng]).addTo(map);

        document.getElementById('map').classList.remove('picker-mode');
        const btn = document.getElementById(pickerMode.latId === 'add-etab-lat' ? 'add-etab-locate' : 'add-prof-locate');
        btn.textContent = '📍 Positionnée ✓';
        btn.style.background = '#27ae60';
        pickerMode = null;
    });

    document.getElementById('form-add-etab').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            nom: document.getElementById('add-etab-nom').value,
            type: document.getElementById('add-etab-type').value,
            adresse: document.getElementById('add-etab-adresse').value,
            code_postal: document.getElementById('add-etab-cp').value,
            commune: document.getElementById('add-etab-ville').value,
            telephone: document.getElementById('add-etab-tel').value,
            latitude: parseFloat(document.getElementById('add-etab-lat').value),
            longitude: parseFloat(document.getElementById('add-etab-lng').value)
        };
        if (!data.nom || !data.latitude || !data.longitude) {
            alert('Nom et position requis');
            return;
        }
        try {
            const res = await fetch(`${API}/api/data/etablissements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
                document.getElementById('add-success').style.display = 'block';
                document.getElementById('form-add-etab').reset();
                if (pickerMarker) map.removeLayer(pickerMarker);
                loadData();
            } else {
                alert(result.error || 'Erreur');
            }
        } catch (err) {
            alert('Erreur réseau');
        }
    });

    document.getElementById('form-add-prof').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            nom: document.getElementById('add-prof-nom').value,
            prenom: document.getElementById('add-prof-prenom').value,
            profession: document.getElementById('add-prof-metier').value,
            specialite: document.getElementById('add-prof-spec').value,
            secteur: document.getElementById('add-prof-secteur').value,
            accepte_carte_vitale: document.getElementById('add-prof-cv').checked,
            adresse: document.getElementById('add-prof-adresse').value,
            code_postal: document.getElementById('add-prof-cp').value,
            commune: document.getElementById('add-prof-ville').value,
            latitude: parseFloat(document.getElementById('add-prof-lat').value),
            longitude: parseFloat(document.getElementById('add-prof-lng').value)
        };
        if (!data.nom || !data.latitude || !data.longitude) {
            alert('Nom et position requis');
            return;
        }
        try {
            const res = await fetch(`${API}/api/data/professionnels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
                document.getElementById('add-success').style.display = 'block';
                document.getElementById('form-add-prof').reset();
                if (pickerMarker) map.removeLayer(pickerMarker);
                loadData();
            } else {
                alert(result.error || 'Erreur');
            }
        } catch (err) {
            alert('Erreur réseau');
        }
    });
}
