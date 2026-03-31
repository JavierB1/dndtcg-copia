// ==========================================================================
// GLOBAL VARIABLES (non-DOM related)
// ==========================================================================

// Firebase and Firestore SDK imports
import { initializeApp }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

// Configuración de Firebase - Directamente proporcionada
const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

let app;
let db;
let auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    console.error("Error: firebaseConfig no está disponible o no tiene un 'projectId'. No se pudo inicializar la app.");
}

const appId = firebaseConfig.projectId;
let userId = null;
let currentAdminUser = null;

let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = []; 

const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedProductsPage = 1;

let currentDeleteTarget = null;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn, closeSidebarBtn, sidebarMenu, sidebarOverlay;
let loginModal, loginForm, loginMessage, usernameInput, passwordInput, togglePasswordVisibilityBtn; 
let navDashboard, navCards, navSealedProducts, navCategories, navOrders, navLogout;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection; 
let addCardBtn, addSealedProductBtn, addCategoryBtn;
let cardModal, cardModalTitle, cardForm, cardId, cardName, cardCode, cardExpansion, cardImage, cardPrice, cardStock, cardCategory, saveCardBtn;
let sealedProductModal, sealedProductModalTitle, sealedProductForm, sealedProductId, sealedProductName, sealedProductImage, sealedProductCategory, sealedProductPrice, sealedProductStock, saveSealedProductBtn;
let categoryModal, categoryModalTitle, categoryForm, categoryId, categoryName, saveCategoryBtn;
let confirmModal, confirmMessage, cancelDeleteBtn, confirmDeleteBtn;
let cardsTable, sealedProductsTable, categoriesTable, ordersTable; 
let adminSearchInput, adminCategoryFilter, adminPrevPageBtn, adminNextPageBtn, adminPageInfo;
let totalCardsCount, totalSealedProductsCount, outOfStockCount, uniqueCategoriesCount;
let messageModal, closeMessageModalBtn, messageModalTitle, messageModalText, okMessageModalBtn;
let orderDetailsModal, closeOrderDetailsModalBtn, orderDetailsContent, orderStatusSelect, updateOrderStatusBtn;

// REFERENCIAS DEL BUSCADOR RÁPIDO (REEMPLAZA AL ESCÁNER)
let quickSearchModal, openQuickSearchBtn, closeQuickSearchBtn, searchStatusMessage;
let searchCardNumberInput, searchSetIdInput, submitSearchBtn;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => section?.classList.remove('active'));
    sectionToShow?.classList.add('active');
}

function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function showLoginError(message) {
    if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.style.display = 'block';
    }
}

function clearLoginError() {
    if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.style.display = 'none';
    }
}

function showMessageModal(title, text) {
    if (messageModalTitle) messageModalTitle.textContent = title;
    if (messageModalText) messageModalText.textContent = text;
    openModal(messageModal);
}

// ==========================================================================
// FUNCIÓN DE BÚSQUEDA RÁPIDA POR API
// ==========================================================================

async function handleQuickSearch() {
    const number = searchCardNumberInput.value.trim();
    const setId = searchSetIdInput.value.trim().toLowerCase();

    if (!number) {
        searchStatusMessage.textContent = "Por favor ingresa el número de la carta.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }

    searchStatusMessage.textContent = "Buscando en la base de datos oficial...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        // Construimos la query. Si hay setId, la búsqueda es exacta.
        let query = `number:${number}`;
        if (setId) {
            query += ` (set.id:${setId}* OR set.symbol:${setId}*)`;
        }

        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${query}`);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            // Si hay varios resultados, intentamos ser más precisos o tomamos el primero
            let bestMatch = data.data[0];
            
            // Si el usuario puso expansión, intentamos filtrar por el ID exacto del set
            if (setId) {
                const filtered = data.data.find(c => c.set.id.toLowerCase().includes(setId));
                if (filtered) bestMatch = filtered;
            }

            fillFormWithAPIData(bestMatch, `${number}/${bestMatch.set.printedTotal}`);
            closeModal(quickSearchModal);
            searchCardNumberInput.value = "";
            searchSetIdInput.value = "";
            searchStatusMessage.textContent = "";
        } else {
            searchStatusMessage.textContent = "No se encontró ninguna carta con esos datos.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        console.error("Error en búsqueda:", error);
        searchStatusMessage.textContent = "Error de conexión con la API.";
    } finally {
        submitSearchBtn.disabled = false;
    }
}

function fillFormWithAPIData(card, displayCode) {
    openModal(cardModal);
    cardModalTitle.textContent = '¡Carta Encontrada!';

    cardName.value = card.name;
    cardCode.value = displayCode || card.number;
    cardExpansion.value = card.set.name;
    cardImage.value = card.images.large || card.images.small || '';

    // Precio de mercado (TCGPlayer)
    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        const firstKey = Object.keys(p)[0];
        price = p[firstKey].market || p[firstKey].mid || 0;
    }
    cardPrice.value = parseFloat(price).toFixed(2);
    cardCategory.value = 'Pokémon TCG';

    // Animación visual de éxito
    [cardName, cardCode, cardExpansion, cardImage].forEach(f => {
        f.style.backgroundColor = '#ecfdf5';
        setTimeout(() => f.style.backgroundColor = '', 2000);
    });
}

// ==========================================================================
// FIREBASE AUTH & DATA
// ==========================================================================

async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    clearLoginError();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (e) {
        showLoginError('Credenciales inválidas.');
    }
}

async function handleLogout() {
    await signOut(auth);
    hideAllSections();
    openModal(loginModal);
}

onAuthStateChanged(auth, (user) => {
    userId = user ? user.uid : null;
});

async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    await loadSealedProductsData();
    await loadOrdersData();
}

async function loadCategories() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/categories`));
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateFilters();
    renderCategoriesTable();
}

function populateFilters() {
    const names = allCategories.map(c => c.name);
    adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona un Juego</option>';
    names.forEach(n => {
        adminCategoryFilter.appendChild(new Option(n, n));
        cardCategory.appendChild(new Option(n, n));
    });
}

async function loadCardsData() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/cards`));
    allCards = snap.docs.map(d => ({ id: d.id, ...d.data(), precio: parseFloat(d.data().precio) || 0, stock: parseInt(d.data().stock) || 0 }));
    renderCardsTable();
    updateStats();
}

async function loadSealedProductsData() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/sealed_products`));
    allSealedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSealedProductsTable();
}

async function loadOrdersData() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/orders`));
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp);
    renderOrdersTable();
}

function renderCardsTable() {
    const tbody = cardsTable.querySelector('tbody');
    tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id}</td>
            <td><img src="${c.imagen_url}" width="40"></td>
            <td>${c.nombre}</td>
            <td>${c.codigo}</td>
            <td>${c.expansion || ''}</td>
            <td>$${c.precio.toFixed(2)}</td>
            <td>${c.stock}</td>
            <td>${c.categoria}</td>
            <td class="action-buttons">
                <button class="action-btn edit edit-card-btn" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete delete-card-btn" data-id="${c.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function renderSealedProductsTable() {
    const tbody = sealedProductsTable.querySelector('tbody');
    tbody.innerHTML = '';
    allSealedProducts.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${p.id}</td><td><img src="${p.imagen_url}" width="40"></td><td>${p.nombre}</td><td>${p.categoria}</td><td>$${parseFloat(p.precio).toFixed(2)}</td><td>${p.stock}</td><td>Acciones</td>`;
    });
}

function renderCategoriesTable() {
    const tbody = categoriesTable.querySelector('tbody');
    tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${c.name}</td><td>Acciones</td>`;
    });
}

function renderOrdersTable() {
    const tbody = ordersTable.querySelector('tbody');
    tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${o.id}</td><td>${new Date(o.timestamp).toLocaleString()}</td><td>${o.customerName}</td><td>$${parseFloat(o.total).toFixed(2)}</td><td>${o.status}</td><td>Acciones</td>`;
    });
}

function updateStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
}

function hideAllSections() {
    [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection].forEach(s => s?.classList.remove('active'));
}

async function handleSaveCard(e) {
    e.preventDefault();
    const data = {
        nombre: cardName.value, codigo: cardCode.value, expansion: cardExpansion.value,
        imagen_url: cardImage.value, precio: cardPrice.value, stock: cardStock.value, categoria: cardCategory.value
    };
    if (cardId.value) await updateDoc(doc(db, `artifacts/${appId}/public/data/cards`, cardId.value), data);
    else await addDoc(collection(db, `artifacts/${appId}/public/data/cards`), data);
    cardForm.reset(); closeModal(cardModal); await loadCardsData();
}

// ==========================================================================
// DOM LOAD & EVENTS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Inyección de estilos para iPad/Móvil
    const style = document.createElement('style');
    style.innerHTML = `
        @media(max-width:768px){.sidebar{position:fixed;left:-260px;z-index:100;transition:0.3s}.sidebar.show{left:0}.main-content{margin-left:0}.admin-modal-content{width:95%}}
        .search-form-group { margin-bottom: 15px; }
        .search-form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.9rem; color: #4a5568; }
        .search-input { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .btn-search { width: 100%; padding: 12px; background: #3182ce; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 10px; }
        .btn-search:disabled { background: #cbd5e0; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    // Asignaciones
    sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    closeSidebarBtn = document.getElementById('closeSidebarBtn');
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    loginMessage = document.getElementById('loginMessage');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    navDashboard = document.getElementById('nav-dashboard');
    navCards = document.getElementById('nav-cards');
    navSealedProducts = document.getElementById('nav-sealed-products');
    navCategories = document.getElementById('nav-categories');
    navOrders = document.getElementById('nav-orders');
    navLogout = document.getElementById('nav-logout');
    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    sealedProductsSection = document.getElementById('sealed-products-section');
    categoriesSection = document.getElementById('categories-section');
    ordersSection = document.getElementById('orders-section');
    addCardBtn = document.getElementById('addCardBtn');
    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardCode = document.getElementById('cardCode');
    cardExpansion = document.getElementById('cardExpansion');
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');
    cardsTable = document.getElementById('cardsTable');
    sealedProductsTable = document.getElementById('sealedProductsTable');
    categoriesTable = document.getElementById('categoriesTable');
    ordersTable = document.getElementById('ordersTable');
    adminCategoryFilter = document.getElementById('adminCategoryFilter');
    totalCardsCount = document.getElementById('totalCardsCount');
    uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');

    // NUEVAS ASIGNACIONES PARA EL BUSCADOR RÁPIDO
    quickSearchModal = document.getElementById('scannerModal'); // Reutilizamos el ID del modal antiguo
    openQuickSearchBtn = document.getElementById('openScannerBtn'); // Reutilizamos el botón
    searchStatusMessage = document.getElementById('scannerStatusMessage');
    
    // Aquí transformamos el contenido del modal de escáner en un formulario de búsqueda
    const modalContent = quickSearchModal.querySelector('.admin-modal-content');
    modalContent.innerHTML = `
        <span class="close-button">&times;</span>
        <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador por Código</h2>
        <div class="search-form-group">
            <label>Número de Carta (ej: 152)</label>
            <input type="text" id="searchCardNumber" class="search-input" placeholder="Escribe el número...">
        </div>
        <div class="search-form-group">
            <label>Código de Expansión (3-4 letras, ej: sv1, pgo, swsh01)</label>
            <input type="text" id="searchSetId" class="search-input" placeholder="Opcional pero recomendado...">
        </div>
        <button id="submitSearch" class="btn-search">Buscar Carta</button>
        <p id="scannerStatusMessage" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></p>
    `;

    // Re-asignamos las referencias internas tras el cambio de HTML
    searchCardNumberInput = document.getElementById('searchCardNumber');
    searchSetIdInput = document.getElementById('searchSetId');
    submitSearchBtn = document.getElementById('submitSearch');
    searchStatusMessage = document.getElementById('scannerStatusMessage');

    openModal(loginModal);

    // Eventos Menú
    sidebarToggleBtn?.addEventListener('click', () => { sidebarMenu.classList.add('show'); sidebarOverlay.style.display = 'block'; });
    sidebarOverlay?.addEventListener('click', () => { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display = 'none'; });

    const navs = [{b:navDashboard, s:dashboardSection}, {b:navCards, s:cardsSection}, {b:navSealedProducts, s:sealedProductsSection}, {b:navCategories, s:categoriesSection}, {b:navOrders, s:ordersSection}];
    navs.forEach(n => n.b?.addEventListener('click', () => { 
        showSection(n.s); 
        if(window.innerWidth <= 768){ sidebarMenu.classList.remove('show'); sidebarOverlay.style.display = 'none'; }
    }));

    // Eventos Buscador
    openQuickSearchBtn?.addEventListener('click', () => { openModal(quickSearchModal); });
    submitSearchBtn?.addEventListener('click', handleQuickSearch);
    
    loginForm?.addEventListener('submit', handleLogin);
    navLogout?.addEventListener('click', handleLogout);
    cardForm?.addEventListener('submit', handleSaveCard);
    addCardBtn?.addEventListener('click', () => { cardForm.reset(); cardId.value = ''; openModal(cardModal); });

    quickSearchModal.addEventListener('click', (e) => {
        if(e.target.classList.contains('close-button')){ closeModal(quickSearchModal); }
    });

    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(cardModal); 
    }));
});
