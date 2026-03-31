// ==========================================================================
// CONFIGURACIÓN Y SERVICIOS DE FIREBASE
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
// FORZAR CIERRE DE SESIÓN AL CARGAR (ELIMINA EL AUTOLOGIN)
// ==========================================================================
// Esto garantiza que CADA VEZ que recargues la página, debas poner la clave.
signOut(auth).catch(err => console.log("Limpiando sesión previa..."));

let allCards = [], allSealedProducts = [], allCategories = [], allOrders = [];
let currentDeleteTarget = null;
const itemsPerPage = 10;
let currentCardsPage = 1;

// ==========================================================================
// REFERENCIAS DOM
// ==========================================================================
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, quickSearchModal, confirmModal, messageModal;
let searchStatusMessage, searchCardNumberInput, searchSetIdInput, submitSearchBtn;
let navLinks = {};

// ==========================================================================
// FUNCIONES DE NAVEGACIÓN Y UI
// ==========================================================================

function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

function showSection(sectionId) {
    // Ocultar todas
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    // Mostrar la seleccionada
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    // Actualizar menú lateral
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if(activeLink) activeLink.classList.add('active');

    // Cerrar menú en móviles
    if(window.innerWidth < 1024) {
        sidebarMenu?.classList.remove('show');
        if(sidebarOverlay) sidebarOverlay.style.display='none';
    }
}

// ==========================================================================
// BUSCADOR TCGPLAYER (TRIM + RECORTE DE SLASH)
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
// CARGA DE DATOS DESDE FIRESTORE
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
            <td>${c.id.substring(0,5)}</td>
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px"></td>
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
// INICIALIZACIÓN Y EVENTOS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias principales para el cambio de pantalla
    loginView = document.getElementById('loginModal');
    adminView = document.querySelector('.admin-container');
    
    // Inyectar Estilos de Pantalla Completa y SVGs
    const style = document.createElement('style');
    style.innerHTML = `
        /* Pantalla de Login Pantalla Completa */
        #loginModal { 
            display: flex; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
            background: #f0f2f5; z-index: 9999; align-items: center; justify-content: center;
        }
        .login-card {
            background: white; padding: 40px; border-radius: 16px; width: 90%; max-width: 400px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1); text-align: center;
        }
        .admin-container { display: none; } /* Oculto por defecto */

        /* SVG Logos Decorativos */
        .svg-container { margin-bottom: 20px; display: flex; justify-content: center; gap: 15px; }
        .svg-icon { width: 50px; height: 50px; fill: #3182ce; opacity: 0.8; }
    `;
    document.head.appendChild(style);

    // Ajustar el HTML del Login para que sea la pantalla completa
    loginView.innerHTML = `
        <div class="login-card">
            <div class="svg-container">
                <!-- SVG: Pokébola Simplificada -->
                <svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.44.04-.87.11-1.29H8.5c.34.78 1.11 1.33 2.01 1.33.9 0 1.67-.55 2.01-1.33h4.39c.07.42.11.85.11 1.29 0 4.41-3.59 8-8 8zm8.39-9.29h-4.39c-.34-.78-1.11-1.33-2.01-1.33-.9 0-1.67.55-2.01 1.33H3.61c.42-3.1 2.67-5.63 5.63-6.61.16-.06.32-.1.48-.15.42-.12.86-.21 1.31-.26.31-.03.63-.04.97-.04.34 0 .66.01.97.04.45.05.89.14 1.31.26.16.05.32.09.48.15 2.96.98 5.21 3.51 5.63 6.61z"/>
                </svg>
                <!-- SVG: Frasco Perfume (Nevada) -->
                <svg class="svg-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 8V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H5v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8h-3zM9 5h6v3H9V5zm8 14H7V10h10v9z"/>
                </svg>
            </div>
            <h2 style="margin-bottom: 5px; color: #2d3748;">DND TCG Admin</h2>
            <p style="color: #718096; margin-bottom: 25px; font-size: 0.9rem;">Gestión de Inventario y Nevada</p>
            <form id="loginForm">
                <input type="email" id="username" placeholder="Correo electrónico" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 8px;" required>
                <input type="password" id="password" placeholder="Contraseña" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 8px;" required>
                <button type="submit" style="width: 100%; padding: 14px; background: #3182ce; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Acceder al Panel</button>
            </form>
            <p id="loginMessage" style="color: #e53e3e; margin-top: 15px; font-size: 0.85rem; display: none;"></p>
        </div>
    `;

    // Re-vincular elementos del formulario inyectado
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const msg = document.getElementById('loginMessage');
        const btn = e.target.querySelector('button');

        try {
            btn.disabled = true;
            btn.textContent = "Verificando...";
            // Obligar a que la sesión solo viva mientras la pestaña esté abierta
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) {
            btn.disabled = false;
            btn.textContent = "Acceder al Panel";
            msg.textContent = "Credenciales incorrectas.";
            msg.style.display = "block";
        }
    });

    // Observador de Estado
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginView.style.display = 'none';
            adminView.style.display = 'flex';
            loadAllData();
        } else {
            loginView.style.display = 'flex';
            adminView.style.display = 'none';
        }
    });

    // Eventos de Navegación Lateral
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('id').replace('nav-', '') + '-section';
            showSection(section.replace('sealed-products', 'sealed-products'));
        });
    });

    // Configurar el buscador manual
    quickSearchModal = document.getElementById('scannerModal');
    const modalContent = quickSearchModal?.querySelector('.admin-modal-content');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 style="margin-bottom: 15px;"><i class="fas fa-search"></i> Buscador Inteligente</h2>
            <div style="margin-bottom: 15px; text-align: left;">
                <label style="font-weight: bold; font-size: 0.8rem;">Número de Carta (ej: 028 o 028/151)</label>
                <input type="text" id="searchCardNumber" placeholder="Ej: 028/151" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e0; margin-top: 5px;">
            </div>
            <div style="margin-bottom: 15px; text-align: left;">
                <label style="font-weight: bold; font-size: 0.8rem;">Filtro Expansión (ej: 151, obsidian)</label>
                <input type="text" id="searchSetId" placeholder="Opcional..." style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e0; margin-top: 5px;">
            </div>
            <button id="submitSearch" style="width: 100%; padding: 14px; background: #3182ce; color: white; border-radius: 8px; font-weight: bold; border: none; cursor: pointer;">Consultar TCGPlayer</button>
            <p id="searchStatus" style="margin-top: 15px; font-size: 0.9rem;"></p>
        `;
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
    }

    // Botones de Apertura y Cierre
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));
    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(quickSearchModal);
        closeModal(document.getElementById('cardModal'));
    }));

    // Cierre de sesión manual
    document.getElementById('nav-logout')?.addEventListener('click', () => {
        signOut(auth).then(() => location.reload());
    });
});
