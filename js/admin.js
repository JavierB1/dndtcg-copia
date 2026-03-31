// ==========================================================================
// GLOBAL VARIABLES & FIREBASE SETUP
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    getDocs, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    runTransaction, 
    getDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

let currentAdminUser = null;

// Estados de datos
let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = [];

// Paginación y filtros
const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedProductsPage = 1;
let currentDeleteTarget = null;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================

// Estructura General
const adminContainer = document.querySelector('.admin-container');
const sidebarMenu = document.getElementById('sidebar-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sectionTitle = document.getElementById('section-title');

// Login
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// Navegación
const navLinks = document.querySelectorAll('.sidebar-nav a');
const navLogout = document.getElementById('nav-logout');

// Secciones
const sections = document.querySelectorAll('.admin-section');
const dashboardSection = document.getElementById('dashboard-section');
const cardsSection = document.getElementById('cards-section');
const sealedProductsSection = document.getElementById('sealed-products-section');
const categoriesSection = document.getElementById('categories-section');
const ordersSection = document.getElementById('orders-section');

// Tablas y Contenedores
const cardsTableBody = document.getElementById('cardsTableBody');
const sealedProductsTableBody = document.getElementById('sealedProductsTableBody');
const categoriesTableBody = document.getElementById('categoriesTableBody');
const ordersTableBody = document.getElementById('ordersTableBody');

// Formularios y Modales
const cardModal = document.getElementById('cardModal');
const cardForm = document.getElementById('cardForm');
const categoryModal = document.getElementById('categoryModal');
const categoryForm = document.getElementById('categoryForm');
const sealedProductModal = document.getElementById('sealedProductModal');
const sealedProductForm = document.getElementById('sealedProductForm');

// Escáner
const scanCardBtn = document.getElementById('scanCardBtn');
const scannerModal = document.getElementById('scannerModal');
const scannerVideo = document.getElementById('scannerVideo');

// Stats Dashboard
const totalCardsCount = document.getElementById('totalCardsCount');
const totalSealedProductsCount = document.getElementById('totalSealedProductsCount');
const outOfStockCount = document.getElementById('outOfStockCount');
const uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');

// Filtros de búsqueda
const adminSearchInput = document.getElementById('adminSearchInput');
const adminCategoryFilter = document.getElementById('adminCategoryFilter');

// ==========================================================================
// AUTHENTICATION GUARD
// ==========================================================================

if (adminContainer) adminContainer.style.display = 'none';

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentAdminUser = user;
        if (adminContainer) {
            adminContainer.style.display = 'flex';
            setTimeout(() => { adminContainer.style.opacity = '1'; }, 10);
        }
        if (loginModal) loginModal.style.display = 'none';
        initDashboard();
    } else {
        currentAdminUser = null;
        if (adminContainer) adminContainer.style.display = 'none';
        if (loginModal) loginModal.style.display = 'flex';
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const email = usernameInput.value;
    const pass = passwordInput.value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        if (loginMessage) {
            loginMessage.textContent = "Error: Credenciales inválidas.";
            loginMessage.style.display = "block";
        }
    }
}

async function handleLogout() {
    await signOut(auth);
    window.location.reload();
}

// ==========================================================================
// CORE DATA LOADERS
// ==========================================================================

function initDashboard() {
    loadCards();
    loadCategories();
    loadSealedProducts();
    loadOrders();
    setupEventListeners();
}

function loadCards() {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'cards');
    onSnapshot(ref, (snapshot) => {
        allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCardsTable();
        updateStats();
    });
}

function loadCategories() {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    onSnapshot(ref, (snapshot) => {
        allCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCategoriesTable();
        updateCategorySelects();
        renderCategoryFilters();
    });
}

function loadSealedProducts() {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products');
    onSnapshot(ref, (snapshot) => {
        allSealedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSealedProductsTable();
    });
}

function loadOrders() {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    onSnapshot(ref, (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrdersTable();
    });
}

// ==========================================================================
// RENDERING FUNCTIONS
// ==========================================================================

function renderCardsTable() {
    if (!cardsTableBody) return;
    cardsTableBody.innerHTML = '';
    
    const searchTerm = adminSearchInput ? adminSearchInput.value.toLowerCase() : "";
    const categoryTerm = adminCategoryFilter ? adminCategoryFilter.value : "";

    const filtered = allCards.filter(card => {
        const matchesSearch = (card.nombre || "").toLowerCase().includes(searchTerm) || 
                              (card.codigo || "").toLowerCase().includes(searchTerm);
        const matchesCategory = categoryTerm === "" || card.categoria === categoryTerm;
        return matchesSearch && matchesCategory;
    });

    const start = (currentCardsPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(start, start + itemsPerPage);

    paginatedItems.forEach(card => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><small>${card.id.substring(0, 5)}...</small></td>
            <td><img src="${card.imagen_url || 'https://placehold.co/40'}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40'"></td>
            <td style="font-weight:bold; color:#6366f1;">${card.codigo || '---'}</td>
            <td>${card.nombre}</td>
            <td>$${card.precio}</td>
            <td><span class="badge ${card.stock > 0 ? 'bg-success' : 'bg-danger'}">${card.stock}</span></td>
            <td>${card.categoria}</td>
            <td class="action-buttons">
                <button onclick="openEditCardModal('${card.id}')" class="edit-button"><i class="fas fa-edit"></i></button>
                <button onclick="handleDeleteCard('${card.id}')" class="delete-button"><i class="fas fa-trash"></i></button>
            </td>
        `;
        cardsTableBody.appendChild(row);
    });
}

function renderSealedProductsTable() {
    if (!sealedProductsTableBody) return;
    sealedProductsTableBody.innerHTML = '';
    allSealedProducts.forEach(prod => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><small>${prod.id.substring(0, 5)}...</small></td>
            <td><img src="${prod.imagen_url || 'https://placehold.co/40'}" width="40" onerror="this.src='https://placehold.co/40'"></td>
            <td>${prod.nombre}</td>
            <td>$${prod.precio}</td>
            <td>${prod.stock}</td>
            <td class="action-buttons">
                <button onclick="openEditSealedModal('${prod.id}')" class="edit-button"><i class="fas fa-edit"></i></button>
                <button onclick="handleDeleteSealed('${prod.id}')" class="delete-button"><i class="fas fa-trash"></i></button>
            </td>
        `;
        sealedProductsTableBody.appendChild(row);
    });
}

function renderCategoriesTable() {
    if (!categoriesTableBody) return;
    categoriesTableBody.innerHTML = '';
    allCategories.forEach(cat => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cat.nombre}</td>
            <td class="action-buttons">
                <button onclick="handleDeleteCategory('${cat.id}')" class="delete-button"><i class="fas fa-trash"></i></button>
            </td>
        `;
        categoriesTableBody.appendChild(row);
    });
}

function renderOrdersTable() {
    if (!ordersTableBody) return;
    ordersTableBody.innerHTML = '';
    allOrders.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.id.substring(0, 8)}</td>
            <td>${order.customerName}</td>
            <td>$${order.total}</td>
            <td><span class="status-badge ${order.status}">${order.status}</span></td>
            <td><button onclick="viewOrderDetails('${order.id}')" class="edit-button">Detalles</button></td>
        </tr>
        `;
        ordersTableBody.appendChild(row);
    });
}

// ==========================================================================
// CRUD ACTIONS & LOGIC
// ==========================================================================

async function saveCard(e) {
    e.preventDefault();
    if (!currentAdminUser) return;

    const cardData = {
        nombre: document.getElementById('cardName').value,
        codigo: document.getElementById('cardCode').value,
        imagen_url: document.getElementById('cardImage').value,
        precio: parseFloat(document.getElementById('cardPrice').value) || 0,
        stock: parseInt(document.getElementById('cardStock').value) || 0,
        categoria: document.getElementById('cardCategory').value,
        lastUpdated: new Date().toISOString()
    };

    try {
        const id = document.getElementById('cardId').value;
        if (id) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), cardData);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), cardData);
        }
        closeModals();
    } catch (err) {
        alert("Error al guardar: " + err.message);
    }
}

async function saveSealedProduct(e) {
    e.preventDefault();
    const prodData = {
        nombre: document.getElementById('sealedProductName').value,
        imagen_url: document.getElementById('sealedProductImage').value,
        precio: parseFloat(document.getElementById('sealedProductPrice').value) || 0,
        stock: parseInt(document.getElementById('sealedProductStock').value) || 0,
        categoria: document.getElementById('sealedProductCategory').value
    };
    try {
        const id = document.getElementById('sealedProductId').value;
        if (id) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id), prodData);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'), prodData);
        }
        closeModals();
    } catch (e) { console.error(e); }
}

async function saveCategory(e) {
    e.preventDefault();
    const nombre = document.getElementById('categoryName').value;
    if (!nombre) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { nombre });
        closeModals();
    } catch (e) { console.error(e); }
}

// ==========================================================================
// INVENTORY & ORDERS MANAGEMENT (TRANSACCIONES)
// ==========================================================================

window.viewOrderDetails = async (orderId) => {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const detailsHtml = `
        <div class="order-info">
            <p><strong>Cliente:</strong> ${order.customerName}</p>
            <p><strong>WhatsApp:</strong> ${order.whatsapp}</p>
            <p><strong>Total:</strong> $${order.total}</p>
            <p><strong>Estado Actual:</strong> <span class="status-badge ${order.status}">${order.status}</span></p>
        </div>
        <hr>
        <div class="order-items">
            ${JSON.parse(order.cart).map(item => `
                <div class="item-row">
                    <span>${item.nombre} x${item.quantity}</span>
                    <span>$${(item.precio * item.quantity).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>
        <div class="order-actions">
            <select id="updateStatusSelect">
                <option value="pending" ${order.status==='pending'?'selected':''}>Pendiente</option>
                <option value="completed" ${order.status==='completed'?'selected':''}>Completado</option>
                <option value="cancelled" ${order.status==='cancelled'?'selected':''}>Cancelado</option>
            </select>
            <button onclick="updateOrderStatus('${order.id}')" class="btn-save">Actualizar Estado</button>
        </div>
    `;
    // Asumiendo un modal de detalles
    const detailModal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('orderDetailsContent');
    if (detailModal && content) {
        content.innerHTML = detailsHtml;
        detailModal.classList.add('active');
    }
};

window.updateOrderStatus = async (orderId) => {
    const newStatus = document.getElementById('updateStatusSelect').value;
    const order = allOrders.find(o => o.id === orderId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
            
            // Si se cancela, devolvemos stock
            if (newStatus === 'cancelled' && order.status !== 'cancelled') {
                const cart = JSON.parse(order.cart);
                for (const item of cart) {
                    const coll = item.type === 'card' ? 'cards' : 'sealed_products';
                    const itemRef = doc(db, 'artifacts', appId, 'public', 'data', coll, item.id);
                    const itemSnap = await transaction.get(itemRef);
                    if (itemSnap.exists()) {
                        transaction.update(itemRef, { stock: itemSnap.data().stock + item.quantity });
                    }
                }
            }
            transaction.update(orderRef, { status: newStatus });
        });
        document.getElementById('orderDetailsModal').classList.remove('active');
    } catch (e) {
        alert("Error al actualizar: " + e.message);
    }
};

// ==========================================================================
// UI HELPERS & EVENT LISTENERS
// ==========================================================================

function setupEventListeners() {
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (navLogout) navLogout.addEventListener('click', handleLogout);

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const sectionId = link.id.replace('nav-', '') + '-section';
            if (document.getElementById(sectionId)) {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                sections.forEach(s => s.classList.remove('active'));
                document.getElementById(sectionId).classList.add('active');
                if (sectionTitle) sectionTitle.textContent = link.textContent.trim();
            }
        });
    });

    if (cardForm) cardForm.addEventListener('submit', saveCard);
    if (sealedProductForm) sealedProductForm.addEventListener('submit', saveSealedProduct);
    if (categoryForm) categoryForm.addEventListener('submit', saveCategory);
    
    if (adminSearchInput) adminSearchInput.addEventListener('input', renderCardsTable);
    if (adminCategoryFilter) adminCategoryFilter.addEventListener('change', renderCardsTable);

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
}

function closeModals() {
    document.querySelectorAll('.admin-modal').forEach(m => m.classList.remove('active'));
    if (cardForm) cardForm.reset();
    if (categoryForm) categoryForm.reset();
    if (sealedProductForm) sealedProductForm.reset();
}

function updateStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (totalSealedProductsCount) totalSealedProductsCount.textContent = allSealedProducts.length;
    if (outOfStockCount) outOfStockCount.textContent = allCards.filter(c => c.stock <= 0).length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
}

function updateCategorySelects() {
    const selects = [document.getElementById('cardCategory'), document.getElementById('sealedProductCategory')];
    selects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        allCategories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.nombre;
            opt.textContent = cat.nombre;
            select.appendChild(opt);
        });
        select.value = currentVal;
    });
}

function renderCategoryFilters() {
    if (!adminCategoryFilter) return;
    const current = adminCategoryFilter.value;
    adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    allCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.nombre;
        opt.textContent = cat.nombre;
        adminCategoryFilter.appendChild(opt);
    });
    adminCategoryFilter.value = current;
}

// ==========================================================================
// GLOBAL WINDOW FUNCTIONS
// ==========================================================================

window.openEditCardModal = (id) => {
    const card = allCards.find(c => c.id === id);
    if (card) {
        document.getElementById('cardId').value = card.id;
        document.getElementById('cardName').value = card.nombre;
        document.getElementById('cardCode').value = card.codigo || '';
        document.getElementById('cardImage').value = card.imagen_url;
        document.getElementById('cardPrice').value = card.precio;
        document.getElementById('cardStock').value = card.stock;
        document.getElementById('cardCategory').value = card.categoria;
        cardModal.classList.add('active');
    }
};

window.openEditSealedModal = (id) => {
    const prod = allSealedProducts.find(p => p.id === id);
    if (prod) {
        document.getElementById('sealedProductId').value = prod.id;
        document.getElementById('sealedProductName').value = prod.nombre;
        document.getElementById('sealedProductImage').value = prod.imagen_url;
        document.getElementById('sealedProductPrice').value = prod.precio;
        document.getElementById('sealedProductStock').value = prod.stock;
        document.getElementById('sealedProductCategory').value = prod.categoria;
        sealedProductModal.classList.add('active');
    }
};

window.handleDeleteCard = async (id) => {
    if (confirm("¿Estás seguro de eliminar esta carta?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id));
    }
};

window.handleDeleteSealed = async (id) => {
    if (confirm("¿Eliminar este producto sellado?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id));
    }
};

window.handleDeleteCategory = async (id) => {
    if (confirm("¿Eliminar esta categoría?")) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id));
    }
};
