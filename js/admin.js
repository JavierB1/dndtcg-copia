// ==========================================================================
// 1. CONFIGURACIÓN Y SERVICIOS DE FIREBASE
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserSessionPersistence 
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc 
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = firebaseConfig.projectId;

// ==========================================================================
// 2. LOGOUT FORZADO (ELIMINA EL AUTOLOGIN)
// ==========================================================================
let isForcedLogoutDone = false;
signOut(auth).then(() => {
    isForcedLogoutDone = true;
});

let allCards = [], allCategories = [];
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, quickSearchModal;
let searchStatusMessage, searchCardNumberInput, searchSetIdInput, submitSearchBtn;

// ==========================================================================
// 3. FUNCIONES DE UI Y NAVEGACIÓN
// ==========================================================================

function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const activeLink = document.getElementById('nav-' + sectionId.replace('-section', ''));
    if(activeLink) activeLink.classList.add('active');

    if(window.innerWidth < 1024) {
        sidebarMenu?.classList.remove('show');
        if(sidebarOverlay) sidebarOverlay.style.display='none';
    }
}

// ==========================================================================
// 4. BÚSQUEDA TCGPLAYER
// ==========================================================================

async function handleQuickSearch() {
    let rawInput = searchCardNumberInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();

    if (!rawInput) {
        searchStatusMessage.textContent = "Ingresa el número.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }

    let cardNumber = rawInput.includes('/') ? rawInput.split('/')[0].trim() : rawInput;
    let totalHint = rawInput.includes('/') ? rawInput.split('/')[1].trim() : null;

    searchStatusMessage.textContent = "Consultando TCGPlayer...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        let query = `number:"${cardNumber}"`;
        if (setIdInput) query += ` (set.id:"${setIdInput}*" OR set.name:"${setIdInput}*")`;

        const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            let card = totalHint ? data.data.find(c => c.set.printedTotal == totalHint) : data.data[0];
            if (!card) card = data.data[0];

            fillCardForm(card);
            clearSearchInputs();
            closeModal(quickSearchModal);
        } else {
            searchStatusMessage.textContent = "No se encontró nada.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        searchStatusMessage.textContent = "Error de conexión.";
    } finally {
        submitSearchBtn.disabled = false;
    }
}

function clearSearchInputs() {
    if (searchCardNumberInput) searchCardNumberInput.value = '';
    if (searchSetIdInput) searchSetIdInput.value = '';
    if (searchStatusMessage) searchStatusMessage.textContent = '';
}

function fillCardForm(card) {
    openModal(cardModal);
    document.getElementById('cardId').value = '';
    document.getElementById('cardName').value = card.name;
    document.getElementById('cardCode').value = `${card.number}/${card.set.printedTotal}`;
    document.getElementById('cardExpansion').value = card.set.name;
    document.getElementById('cardImage').value = card.images.large || card.images.small;
    
    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        const cat = ['holofoil', 'reverseHolofoil', 'normal'].find(t => p[t]);
        price = cat ? (p[cat].market || 0) : 0;
    }
    document.getElementById('cardPrice').value = parseFloat(price).toFixed(2);
    document.getElementById('cardCategory').value = 'Pokémon TCG';
}

// ==========================================================================
// 5. CARGA DE DATOS
// ==========================================================================

async function loadAllData() {
    try {
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const catSelect = document.getElementById('cardCategory');
        if(catSelect) {
            catSelect.innerHTML = '<option value="" disabled selected>Selecciona Juego</option>';
            allCategories.forEach(c => catSelect.appendChild(new Option(c.name, c.name)));
        }
        updateStats();
    } catch (e) { console.error(e); }
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${c.id}"><i class="fas fa-edit"></i></button>
            </td>
        `;
    });
}

function updateStats() {
    const el = document.getElementById('totalCardsCount');
    if(el) el.textContent = allCards.length;
}

// ==========================================================================
// 6. INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    loginView = document.getElementById('loginModal');
    adminView = document.querySelector('.admin-container');
    
    // Aseguramos que el contenido del login sea TCG EXCLUSIVO (Sin Nevada ni Perfume)
    loginView.innerHTML = `
        <div class="login-card">
            <div class="svg-header">
                <!-- Pokébola Minimalista -->
                <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#3182ce" stroke-width="2" fill="none"/>
                    <line x1="2" y1="12" x2="22" y2="12" stroke="#3182ce" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" stroke="#3182ce" stroke-width="2" fill="white"/>
                </svg>
            </div>
            <h2 style="font-weight: 700; color: #1a202c; margin-bottom: 8px;">DND TCG Panel</h2>
            <p style="color: #718096; margin-bottom: 32px; font-size: 0.95rem;">Acceso Administrativo de Inventario</p>
            
            <form id="loginForm">
                <div style="text-align: left; margin-bottom: 16px;">
                    <label style="font-size: 0.8rem; font-weight: 600; color: #4a5568; margin-left: 4px;">Email</label>
                    <input type="email" id="username" placeholder="admin@dndtcg.com" style="width: 100%; padding: 14px; margin-top: 4px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 1rem;" required>
                </div>
                <div style="text-align: left; margin-bottom: 24px;">
                    <label style="font-size: 0.8rem; font-weight: 600; color: #4a5568; margin-left: 4px;">Contraseña</label>
                    <input type="password" id="password" placeholder="••••••••" style="width: 100%; padding: 14px; margin-top: 4px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 1rem;" required>
                </div>
                <button type="submit" id="loginBtnSubmit" style="width: 100%; padding: 16px; background: #3182ce; color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer;">
                    Iniciar Sesión
                </button>
            </form>
            <p id="loginMessage" style="color: #e53e3e; margin-top: 20px; font-size: 0.85rem; display: none; padding: 10px; background: #fff5f5; border-radius: 8px;"></p>
        </div>
    `;

    // Manejar Login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const msg = document.getElementById('loginMessage');
        const btn = document.getElementById('loginBtnSubmit');

        try {
            btn.disabled = true;
            btn.textContent = "Verificando...";
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) {
            btn.disabled = false;
            btn.textContent = "Iniciar Sesión";
            msg.textContent = "Credenciales incorrectas.";
            msg.style.display = "block";
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user && isForcedLogoutDone) {
            loginView.style.setProperty('display', 'none', 'important');
            adminView.style.setProperty('display', 'flex', 'important');
            loadAllData();
        } else {
            adminView.style.setProperty('display', 'none', 'important');
            loginView.style.setProperty('display', 'flex', 'important');
        }
    });

    // Configurar Modal de Búsqueda
    quickSearchModal = document.getElementById('scannerModal');
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador TCG</h2>
            <div style="margin-bottom: 16px; text-align: left;">
                <label style="font-weight: 700; font-size: 0.85rem;">Número de Carta (ej: 028/151)</label>
                <input type="text" id="searchCardNumber" placeholder="Número..." style="width: 100%; padding: 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <div style="margin-bottom: 24px; text-align: left;">
                <label style="font-weight: 700; font-size: 0.85rem;">Expansión (ej: sv1, 151)</label>
                <input type="text" id="searchSetId" placeholder="Opcional..." style="width: 100%; padding: 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <button id="submitSearch" style="width: 100%; padding: 16px; background: #3182ce; color: white; border-radius: 12px; font-weight: 700; border: none; cursor: pointer;">
                Consultar TCGPlayer
            </button>
            <p id="searchStatus" style="margin-top: 20px; font-size: 0.95rem;"></p>
        `;
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
    }

    // Navegación Sidebar
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('id').replace('nav-', '') + '-section';
            showSection(sectionId);
        });
    });

    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));
    document.getElementById('refreshAdminPageBtn')?.addEventListener('click', () => location.reload());

    // Cierre de modales
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-button')) {
            closeModal(quickSearchModal);
            closeModal(document.getElementById('cardModal'));
            clearSearchInputs();
        }
    });

    document.getElementById('nav-logout')?.addEventListener('click', () => {
        signOut(auth).then(() => location.reload());
    });
});
