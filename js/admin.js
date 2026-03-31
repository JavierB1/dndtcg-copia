// ==========================================================================
// 1. CONFIGURACIÓN Y SERVICIOS DE FIREBASE
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserSessionPersistence 
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { 
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc 
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
// 2. CONTROL DE SESIÓN (OBLIGATORIO AL RECARGAR PESTAÑA)
// ==========================================================================
let isForcedLogoutDone = sessionStorage.getItem('forcedLogout') === 'true';

if (!isForcedLogoutDone) {
    signOut(auth).then(() => {
        isForcedLogoutDone = true;
        sessionStorage.setItem('forcedLogout', 'true');
    });
}

// Variables Globales
let allCards = [], allCategories = [], allSealed = [], allOrders = [];
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, quickSearchModal;
let searchStatusMessage, searchCardNumberInput, searchSetIdInput, submitSearchBtn;

// ==========================================================================
// 3. FUNCIONES DE UI (OPTIMIZADAS PARA IPAD/TOUCH)
// ==========================================================================

function openModal(m) { 
    if(m){ 
        m.style.display='flex'; 
        document.body.style.overflow='hidden'; 
    } 
}

function closeModal(m) { 
    if(m){ 
        m.style.display='none'; 
        document.body.style.overflow=''; 
    } 
}

function clearSearchInputs() {
    if (searchCardNumberInput) searchCardNumberInput.value = '';
    if (searchSetIdInput) searchSetIdInput.value = '';
    if (searchStatusMessage) searchStatusMessage.textContent = '';
}

function toggleSidebar(show) {
    if (show) {
        sidebarMenu?.classList.add('show');
        sidebarOverlay?.classList.add('show');
    } else {
        sidebarMenu?.classList.remove('show');
        sidebarOverlay?.classList.remove('show');
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if(activeLink) activeLink.classList.add('active');

    // Auto-cerrar menú en iPad/Móvil tras elegir sección
    if(window.innerWidth <= 1024) {
        toggleSidebar(false);
    }
}

// ==========================================================================
// 4. BÚSQUEDA TCGPLAYER
// ==========================================================================

async function handleQuickSearch() {
    let rawInput = searchCardNumberInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();

    if (!rawInput) {
        searchStatusMessage.textContent = "Ingresa el número de carta.";
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
            clearSearchInputs(); // Limpia campos al encontrar éxito
            closeModal(quickSearchModal);
        } else {
            searchStatusMessage.textContent = "No se encontró la carta.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        searchStatusMessage.textContent = "Error de conexión con la API.";
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
// 5. CRUD Y CARGA DE DATOS
// ==========================================================================

async function handleSaveCard(e) {
    e.preventDefault(); // PREVIENE RECARGA (Evita Logout)
    const id = document.getElementById('cardId').value;
    const data = {
        nombre: document.getElementById('cardName').value,
        codigo: document.getElementById('cardCode').value,
        expansion: document.getElementById('cardExpansion').value,
        imagen_url: document.getElementById('cardImage').value,
        precio: parseFloat(document.getElementById('cardPrice').value),
        stock: parseInt(document.getElementById('cardStock').value),
        categoria: document.getElementById('cardCategory').value
    };

    try {
        if (id) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        }
        closeModal(cardModal);
        await loadAllData();
    } catch (err) {
        console.error("Error al guardar:", err);
    }
}

async function loadAllData() {
    try {
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const catSelects = [document.getElementById('cardCategory'), document.getElementById('sealedProductCategory')];
        catSelects.forEach(sel => {
            if(sel) {
                sel.innerHTML = '<option value="" disabled selected>Selecciona Juego</option>';
                allCategories.forEach(c => sel.appendChild(new Option(c.name, c.name)));
            }
        });

        const sealedSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'));
        allSealed = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedTable();

        const orderSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrdersTable();

        updateStats();
    } catch (e) { console.error("Error en carga:", e); }
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

function renderSealedTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allSealed.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${p.imagen_url}" width="40"></td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria}</td>
            <td>$${p.precio}</td>
            <td>${p.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${p.id}"><i class="fas fa-edit"></i></button>
            </td>
        `;
    });
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${o.id.substring(0,8)}</td>
            <td>${o.customerName}</td>
            <td>$${o.total}</td>
            <td><span class="status-badge ${o.status}">${o.status}</span></td>
            <td><button class="action-btn"><i class="fas fa-eye"></i></button></td>
        `;
    });
}

function updateStats() {
    const cardsCount = document.getElementById('totalCardsCount');
    if(cardsCount) cardsCount.textContent = allCards.length;
    const sealedCount = document.getElementById('totalSealedProductsCount');
    if(sealedCount) sealedCount.textContent = allSealed.length;
    const categoriesCount = document.getElementById('uniqueCategoriesCount');
    if(categoriesCount) categoriesCount.textContent = allCategories.length;
    const stockCount = document.getElementById('outOfStockCount');
    if(stockCount) stockCount.textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

// ==========================================================================
// 6. INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias críticas
    loginView = document.getElementById('loginModal');
    adminView = document.querySelector('.admin-container');
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    cardForm = document.getElementById('cardForm');
    quickSearchModal = document.getElementById('scannerModal');
    cardModal = document.getElementById('cardModal');

    // BOTONES DE HAMBURGUESA (Optimizados para iPad)
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');

    toggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar(true);
    });

    closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar(false);
    });

    sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));

    // NAVEGACIÓN
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            if(sectionId) showSection(sectionId);
        });
    });

    // LOGIN
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
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
            if(msg) {
                msg.textContent = "Credenciales incorrectas.";
                msg.style.display = "block";
            }
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

    // BUSCADOR (CONFIGURACIÓN DINÁMICA)
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button" id="closeScannerX">&times;</span>
            <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador TCG</h2>
            <div style="margin-bottom: 16px; text-align: left;">
                <label style="font-weight: 700; font-size: 0.85rem; color: #4a5568;">Número de Carta (ej: 028/151)</label>
                <input type="text" id="searchCardNumber" placeholder="Número..." style="width: 100%; padding: 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <div style="margin-bottom: 24px; text-align: left;">
                <label style="font-weight: 700; font-size: 0.85rem; color: #4a5568;">Expansión (opcional)</label>
                <input type="text" id="searchSetId" placeholder="Ej: 151, sv1" style="width: 100%; padding: 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <button id="submitSearch" style="width: 100%; padding: 16px; background: #3182ce; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
                Consultar TCGPlayer
            </button>
            <p id="searchStatus" style="margin-top: 20px; font-size: 0.95rem;"></p>
        `;
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
        
        document.getElementById('closeScannerX')?.addEventListener('click', () => {
            closeModal(quickSearchModal);
            clearSearchInputs();
        });
    }

    // EVENTOS DE GUARDADO Y BOTONES
    cardForm?.addEventListener('submit', handleSaveCard);
    
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));
    document.getElementById('refreshAdminPageBtn')?.addEventListener('click', () => location.reload());
    document.getElementById('addCardBtn')?.addEventListener('click', () => {
        cardForm?.reset();
        document.getElementById('cardId').value = '';
        openModal(cardModal);
    });

    // CIERRE GENERAL DE MODALES (X y Click Fuera)
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-button')) {
            const modal = e.target.closest('.admin-modal');
            if(modal) {
                if(modal.id === 'scannerModal') clearSearchInputs();
                closeModal(modal);
            }
        }
        if (e.target.classList.contains('admin-modal')) {
            if(e.target.id === 'scannerModal') clearSearchInputs();
            closeModal(e.target);
        }
    });

    document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
        sessionStorage.removeItem('forcedLogout');
        signOut(auth).then(() => location.reload());
    });
});
