// ==========================================================================
// GLOBAL VARIABLES (Firebase & Logic)
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

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

let allCards = [], allSealedProducts = [], allCategories = [], allOrders = [];
let currentDeleteTarget = null;

// Paginación
const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedPage = 1;

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
let sidebarMenu, sidebarOverlay, loginModal, cardModal, quickSearchModal, sealedProductModal, categoryModal, confirmModal, messageModal, orderDetailsModal;
let cardForm, sealedProductForm, categoryForm;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection;
let searchStatusMessage, searchCardNumberInput, searchSetIdInput, submitSearchBtn;
let navLinks = {};

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

function showSection(sectionToShow, navId) {
    // Ocultar todas las secciones
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(s => s?.classList.remove('active'));
    
    // Mostrar la elegida
    sectionToShow?.classList.add('active');

    // Actualizar clase active en el menú lateral
    Object.values(navLinks).forEach(link => link?.classList.remove('active'));
    if (navLinks[navId]) navLinks[navId].classList.add('active');

    // Cerrar sidebar en móviles
    if(window.innerWidth < 768) {
        sidebarMenu?.classList.remove('show');
        sidebarOverlay ? sidebarOverlay.style.display='none' : null;
    }
}

function showMessage(title, text) {
    const titleEl = document.getElementById('messageModalTitle');
    const textEl = document.getElementById('messageModalText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    openModal(messageModal);
}

// ==========================================================================
// LÓGICA DE BÚSQUEDA TCGPLAYER
// ==========================================================================

async function handleQuickSearch() {
    let rawInput = searchCardNumberInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();

    if (!rawInput) {
        searchStatusMessage.textContent = "Ingresa el número de la carta.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }

    let cardNumber = rawInput;
    let printedTotal = null;
    
    if (rawInput.includes('/')) {
        const parts = rawInput.split('/');
        cardNumber = parts[0].trim();
        printedTotal = parts[1].trim();
    }

    searchStatusMessage.textContent = "Consultando TCGPlayer...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        let queryParts = [`number:"${cardNumber}"`];
        if (setIdInput) queryParts.push(`(set.id:"${setIdInput}*" OR set.name:"${setIdInput}*")`);

        const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(queryParts.join(' '))}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            let bestMatch = printedTotal ? data.data.find(c => c.set.printedTotal == printedTotal) : data.data[0];
            if (!bestMatch) bestMatch = data.data[0];

            fillCardFormWithData(bestMatch);
            closeModal(quickSearchModal);
        } else {
            searchStatusMessage.textContent = "No se encontró la carta.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        searchStatusMessage.textContent = "Error de conexión.";
    } finally {
        submitSearchBtn.disabled = false;
    }
}

function fillCardFormWithData(card) {
    openModal(cardModal);
    document.getElementById('cardId').value = '';
    document.getElementById('cardName').value = card.name;
    document.getElementById('cardCode').value = `${card.number}/${card.set.printedTotal}`;
    document.getElementById('cardExpansion').value = card.set.name;
    document.getElementById('cardImage').value = card.images.large || card.images.small;
    
    let tcgPrice = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        const types = ['holofoil', 'reverseHolofoil', 'normal'];
        const found = types.find(t => p[t]);
        tcgPrice = found ? (p[found].market || p[found].mid || 0) : 0;
    }
    document.getElementById('cardPrice').value = parseFloat(tcgPrice).toFixed(2);
    document.getElementById('cardCategory').value = 'Pokémon TCG';
}

// ==========================================================================
// DATA LOADING & RENDERING
// ==========================================================================

async function loadAllData() {
    try {
        // Cargar Categorías
        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        updateCategorySelects();

        // Cargar Cartas
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        // Cargar Sellados
        const sealedSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'));
        allSealedProducts = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedProductsTable();

        // Cargar Pedidos
        const orderSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp);
        renderOrdersTable();

        updateDashboardStats();
    } catch (e) {
        console.error("Error al cargar datos:", e);
    }
}

function updateDashboardStats() {
    const cardsEl = document.getElementById('totalCardsCount');
    const sealedEl = document.getElementById('totalSealedProductsCount');
    const catEl = document.getElementById('uniqueCategoriesCount');
    const stockEl = document.getElementById('outOfStockCount');

    if(cardsEl) cardsEl.textContent = allCards.length;
    if(sealedEl) sealedEl.textContent = allSealedProducts.length;
    if(catEl) catEl.textContent = allCategories.length;
    if(stockEl) stockEl.textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

function updateCategorySelects() {
    const selects = [document.getElementById('cardCategory'), document.getElementById('sealedProductCategory')];
    selects.forEach(s => {
        if(!s) return;
        s.innerHTML = '<option value="" disabled selected>Selecciona Categoría</option>';
        allCategories.forEach(c => s.appendChild(new Option(c.name, c.name)));
    });
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const start = (currentCardsPage - 1) * itemsPerPage;
    const paginated = allCards.slice(start, start + itemsPerPage);

    paginated.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id.substring(0,6)}...</td>
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>${c.expansion || ''}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td>${c.categoria}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="card"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
    const info = document.getElementById('adminPageInfo');
    if(info) info.textContent = `Página ${currentCardsPage}`;
}

function renderSealedProductsTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const start = (currentSealedPage - 1) * itemsPerPage;
    const paginated = allSealedProducts.slice(start, start + itemsPerPage);

    paginated.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${p.id.substring(0,6)}...</td>
            <td><img src="${p.imagen_url}" width="40" style="border-radius:4px"></td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria}</td>
            <td>$${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit-sealed" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${p.id}" data-type="sealed"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
    const info = document.getElementById('adminSealedPageInfo');
    if(info) info.textContent = `Página ${currentSealedPage}`;
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td class="action-buttons">
                <button class="action-btn edit-cat" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="category"><i class="fas fa-trash"></i></button>
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
            <td>${new Date(o.timestamp).toLocaleDateString()}</td>
            <td>${o.customerName}</td>
            <td>$${parseFloat(o.total).toFixed(2)}</td>
            <td><span class="status-badge ${o.status}">${o.status}</span></td>
            <td><button class="view-order-btn" data-id="${o.id}">Ver</button></td>
        `;
    });
}

// ==========================================================================
// CRUD OPERATIONS
// ==========================================================================

async function handleSaveCard(e) {
    e.preventDefault();
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
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        closeModal(cardModal);
        await loadAllData();
    } catch (err) { showMessage("Error", "No se pudo guardar la carta."); }
}

async function handleSaveSealed(e) {
    e.preventDefault();
    const id = document.getElementById('sealedProductId').value;
    const data = {
        nombre: document.getElementById('sealedProductName').value,
        categoria: document.getElementById('sealedProductCategory').value,
        precio: parseFloat(document.getElementById('sealedProductPrice').value),
        stock: parseInt(document.getElementById('sealedProductStock').value),
        imagen_url: document.getElementById('sealedProductImage').value
    };
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'), data);
        closeModal(sealedProductModal);
        await loadAllData();
    } catch (err) { showMessage("Error", "No se pudo guardar el producto."); }
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const data = { name: document.getElementById('categoryName').value };
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), data);
        closeModal(categoryModal);
        await loadAllData();
    } catch (err) { showMessage("Error", "No se pudo guardar la categoría."); }
}

async function confirmDelete() {
    if (!currentDeleteTarget) return;
    const { id, type } = currentDeleteTarget;
    const paths = { card: 'cards', sealed: 'sealed_products', category: 'categories' };
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', paths[type], id));
        closeModal(confirmModal);
        await loadAllData();
    } catch (err) { showMessage("Error", "No se pudo eliminar el elemento."); }
}

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias Secciones
    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    sealedProductsSection = document.getElementById('sealed-products-section');
    categoriesSection = document.getElementById('categories-section');
    ordersSection = document.getElementById('orders-section');

    // Referencias Modales
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    loginModal = document.getElementById('loginModal');
    cardModal = document.getElementById('cardModal');
    quickSearchModal = document.getElementById('scannerModal');
    sealedProductModal = document.getElementById('sealedProductModal');
    categoryModal = document.getElementById('categoryModal');
    confirmModal = document.getElementById('confirmModal');
    messageModal = document.getElementById('messageModal');
    orderDetailsModal = document.getElementById('orderDetailsModal');

    // Formularios
    cardForm = document.getElementById('cardForm');
    sealedProductForm = document.getElementById('sealedProductForm');
    categoryForm = document.getElementById('categoryForm');

    // Enlaces de navegación
    navLinks = {
        'dashboard': document.getElementById('nav-dashboard'),
        'cards': document.getElementById('nav-cards'),
        'sealed': document.getElementById('nav-sealed-products'),
        'categories': document.getElementById('nav-categories'),
        'orders': document.getElementById('nav-orders')
    };

    // Navegación Sidebar
    navLinks['dashboard']?.addEventListener('click', (e) => { e.preventDefault(); showSection(dashboardSection, 'dashboard'); });
    navLinks['cards']?.addEventListener('click', (e) => { e.preventDefault(); showSection(cardsSection, 'cards'); });
    navLinks['sealed']?.addEventListener('click', (e) => { e.preventDefault(); showSection(sealedProductsSection, 'sealed'); });
    navLinks['categories']?.addEventListener('click', (e) => { e.preventDefault(); showSection(categoriesSection, 'categories'); });
    navLinks['orders']?.addEventListener('click', (e) => { e.preventDefault(); showSection(ordersSection, 'orders'); });
    
    document.getElementById('nav-logout')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        signOut(auth).then(() => location.reload()); 
    });

    // Control del Sidebar (Hamburguesa)
    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => {
        sidebarMenu?.classList.add('show');
        if(sidebarOverlay) sidebarOverlay.style.display = 'block';
    });
    
    document.getElementById('closeSidebarBtn')?.addEventListener('click', () => {
        sidebarMenu?.classList.remove('show');
        if(sidebarOverlay) sidebarOverlay.style.display = 'none';
    });

    sidebarOverlay?.addEventListener('click', () => {
        sidebarMenu?.classList.remove('show');
        sidebarOverlay.style.display = 'none';
    });

    // Botones Añadir
    document.getElementById('addCardBtn')?.addEventListener('click', () => { cardForm.reset(); document.getElementById('cardId').value = ''; openModal(cardModal); });
    document.getElementById('addSealedProductBtn')?.addEventListener('click', () => { sealedProductForm.reset(); document.getElementById('sealedProductId').value = ''; openModal(sealedProductModal); });
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => { categoryForm.reset(); document.getElementById('categoryId').value = ''; openModal(categoryModal); });
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));

    // Eventos de Guardado
    cardForm?.addEventListener('submit', handleSaveCard);
    sealedProductForm?.addEventListener('submit', handleSaveSealed);
    categoryForm?.addEventListener('submit', handleSaveCategory);
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => closeModal(confirmModal));

    // Delegación de eventos para Tablas (Editar/Eliminar)
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const id = btn.dataset.id;
        if (btn.classList.contains('edit')) {
            const c = allCards.find(x => x.id === id);
            if(c) {
                document.getElementById('cardId').value = c.id;
                document.getElementById('cardName').value = c.nombre;
                document.getElementById('cardCode').value = c.codigo;
                document.getElementById('cardExpansion').value = c.expansion;
                document.getElementById('cardImage').value = c.imagen_url;
                document.getElementById('cardPrice').value = c.precio;
                document.getElementById('cardStock').value = c.stock;
                document.getElementById('cardCategory').value = c.categoria;
                openModal(cardModal);
            }
        }
        if (btn.classList.contains('edit-sealed')) {
            const p = allSealedProducts.find(x => x.id === id);
            if(p) {
                document.getElementById('sealedProductId').value = p.id;
                document.getElementById('sealedProductName').value = p.nombre;
                document.getElementById('sealedProductCategory').value = p.categoria;
                document.getElementById('sealedProductPrice').value = p.precio;
                document.getElementById('sealedProductStock').value = p.stock;
                document.getElementById('sealedProductImage').value = p.imagen_url;
                openModal(sealedProductModal);
            }
        }
        if (btn.classList.contains('edit-cat')) {
            const c = allCategories.find(x => x.id === id);
            if(c) {
                document.getElementById('categoryId').value = c.id;
                document.getElementById('categoryName').value = c.name;
                openModal(categoryModal);
            }
        }
        if (btn.classList.contains('delete')) {
            currentDeleteTarget = { id: btn.dataset.id, type: btn.dataset.type };
            openModal(confirmModal);
        }
        if (btn.classList.contains('view-order-btn')) {
            const order = allOrders.find(o => o.id === id);
            if(order) {
                document.getElementById('orderDetailsContent').innerHTML = `
                    <p><strong>Cliente:</strong> ${order.customerName}</p>
                    <p><strong>Total:</strong> $${order.total}</p>
                    <p><strong>Productos:</strong> ${order.cart}</p>
                `;
                openModal(orderDetailsModal);
            }
        }
    });

    // Paginación
    document.getElementById('adminPrevPageBtn')?.addEventListener('click', () => { if(currentCardsPage > 1) { currentCardsPage--; renderCardsTable(); } });
    document.getElementById('adminNextPageBtn')?.addEventListener('click', () => { if(currentCardsPage * itemsPerPage < allCards.length) { currentCardsPage++; renderCardsTable(); } });
    
    document.getElementById('adminSealedPrevPageBtn')?.addEventListener('click', () => { if(currentSealedPage > 1) { currentSealedPage--; renderSealedProductsTable(); } });
    document.getElementById('adminSealedNextPageBtn')?.addEventListener('click', () => { if(currentSealedPage * itemsPerPage < allSealedProducts.length) { currentSealedPage++; renderSealedProductsTable(); } });

    // Configurar Modal de Búsqueda
    const modalContent = quickSearchModal?.querySelector('.admin-modal-content');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador por Código</h2>
            <div class="search-group">
                <label>Número de Carta (ej: 028 o 028/151)</label>
                <input type="text" id="searchCardNumber" class="search-input" placeholder="Escribe el número...">
            </div>
            <div class="search-group">
                <label>Nombre o Código Expansión (mew, 151, obsidian)</label>
                <input type="text" id="searchSetId" class="search-input" placeholder="Opcional...">
            </div>
            <button id="submitSearch" class="btn-search-submit">Buscar Información</button>
            <p id="searchStatus" style="margin-top: 15px; text-align: center; font-size: 0.9rem; min-height: 1.2em;"></p>
        `;
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn?.addEventListener('click', handleQuickSearch);
    }

    // Cierre de Modales (Botón X)
    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(cardModal); closeModal(quickSearchModal); closeModal(sealedProductModal); closeModal(categoryModal); closeModal(confirmModal); closeModal(messageModal); closeModal(orderDetailsModal);
    }));

    // Login
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username')?.value.trim();
        const pass = document.getElementById('password')?.value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            closeModal(loginModal);
            await loadAllData();
        } catch(err) { showMessage("Acceso Denegado", "Correo o contraseña incorrectos."); }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) { 
            closeModal(loginModal); 
            loadAllData(); 
        } else { 
            openModal(loginModal); 
        }
    });
});
