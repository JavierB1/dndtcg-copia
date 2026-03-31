// ==========================================================================
// CONFIGURACIÓN E IMPORTACIONES
// ==========================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = firebaseConfig.projectId;

// Estado Global
let allCards = [], allSealedProducts = [], allCategories = [], allOrders = [];
let currentCardsPage = 1, currentSealedProductsPage = 1;
const itemsPerPage = 10;
let currentDeleteTarget = null;

// ==========================================================================
// REFERENCIAS AL DOM
// ==========================================================================
const elements = {
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    dashboardSection: document.getElementById('dashboard-section'),
    cardsSection: document.getElementById('cards-section'),
    sealedProductsSection: document.getElementById('sealed-products-section'),
    categoriesSection: document.getElementById('categories-section'),
    ordersSection: document.getElementById('orders-section'),
    loginMessage: document.getElementById('loginMessage'),
    adminSearchInput: document.getElementById('adminSearchInput'),
    adminCategoryFilter: document.getElementById('adminCategoryFilter'),
    adminPageInfo: document.getElementById('adminPageInfo'),
    btnLogout: document.getElementById('btnLogout')
};

// ==========================================================================
// FUNCIONES DE CARGA (PROTEGIDAS POR AUTH)
// ==========================================================================

async function loadAllData() {
    if (!auth.currentUser) return;

    try {
        await Promise.all([
            loadCategories(),
            loadCardsData(),
            loadSealedProductsData(),
            loadOrdersData()
        ]);
        updateDashboardStats();
        console.log("Sincronización completa.");
    } catch (error) {
        console.error("Error al cargar datos:", error.message);
    }
}

async function loadCategories() {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    const snap = await getDocs(col);
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategoriesTable();
    populateCategoryFilters();
}

async function loadCardsData() {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'cards');
    const snap = await getDocs(col);
    allCards = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        precio: parseFloat(d.data().precio) || 0, 
        stock: parseInt(d.data().stock) || 0 
    }));
    renderCardsTable();
}

async function loadSealedProductsData() {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products');
    const snap = await getDocs(col);
    allSealedProducts = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        precio: parseFloat(d.data().precio) || 0, 
        stock: parseInt(d.data().stock) || 0 
    }));
    renderSealedProductsTable();
}

async function loadOrdersData() {
    const col = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const snap = await getDocs(col);
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    renderOrdersTable();
}

// ==========================================================================
// MANEJO DE AUTENTICACIÓN
// ==========================================================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Sesión activa:", user.email);
        if (elements.loginModal) elements.loginModal.style.setProperty('display', 'none', 'important');
        if (elements.dashboardSection) elements.dashboardSection.classList.add('active');
        loadAllData();
    } else {
        console.log("No hay sesión. Mostrando login...");
        hideAllSections();
        if (elements.loginModal) {
            elements.loginModal.style.setProperty('display', 'flex', 'important');
        }
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const msg = elements.loginMessage;

    try {
        if(msg) {
            msg.textContent = "Iniciando sesión...";
            msg.style.color = "#6366f1";
            msg.style.display = "block";
        }
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if(msg) {
            msg.textContent = "Error: Credenciales no válidas.";
            msg.style.color = "#ef4444";
        }
        console.error("Error de login:", error.code);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}

function hideAllSections() {
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(s => s.classList.remove('active'));
}

// ==========================================================================
// RENDERIZADO DE TABLAS Y DASHBOARD
// ==========================================================================

function updateDashboardStats() {
    const stats = {
        totalCards: document.getElementById('stat-total-cards'),
        totalStock: document.getElementById('stat-total-stock'),
        totalOrders: document.getElementById('stat-total-orders')
    };

    if (stats.totalCards) stats.totalCards.textContent = allCards.length;
    if (stats.totalStock) {
        const stock = allCards.reduce((acc, card) => acc + (card.stock || 0), 0);
        stats.totalStock.textContent = stock;
    }
    if (stats.totalOrders) stats.totalOrders.textContent = allOrders.length;
}

function renderCardsTable() {
    const tableBody = document.querySelector('#cardsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const query = elements.adminSearchInput ? elements.adminSearchInput.value.toLowerCase() : "";
    const cat = elements.adminCategoryFilter ? elements.adminCategoryFilter.value : "";

    const filtered = allCards.filter(card => {
        const matchesSearch = card.nombre.toLowerCase().includes(query);
        const matchesCategory = cat === "" || card.categoria === cat;
        return matchesSearch && matchesCategory;
    });

    const start = (currentCardsPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    paginated.forEach(card => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${card.id.substring(0, 6)}</td>
            <td><img src="${card.imagen_url || 'https://via.placeholder.com/40'}" onerror="this.src='https://via.placeholder.com/40'"></td>
            <td>${card.nombre}</td>
            <td>$${card.precio.toFixed(2)}</td>
            <td>${card.stock}</td>
            <td>${card.categoria}</td>
            <td class="action-buttons">
                <button class="edit-button" onclick="window.editCard('${card.id}')">Editar</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    if (elements.adminPageInfo) {
        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        elements.adminPageInfo.textContent = `Página ${currentCardsPage} de ${totalPages}`;
    }
}

function renderCategoriesTable() {
    const tableBody = document.querySelector('#categoriesTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    allCategories.forEach(cat => {
        const row = `<tr>
            <td>${cat.id.substring(0,6)}</td>
            <td>${cat.name}</td>
            <td class="action-buttons">
                <button class="delete-category-button">Eliminar</button>
            </td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

function renderSealedProductsTable() {
    const tableBody = document.querySelector('#sealedProductsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    allSealedProducts.forEach(prod => {
        const row = `<tr>
            <td>${prod.id.substring(0,6)}</td>
            <td>${prod.nombre}</td>
            <td>$${prod.precio.toFixed(2)}</td>
            <td>${prod.stock}</td>
            <td class="action-buttons">
                <button class="edit-button">Editar</button>
            </td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

function renderOrdersTable() {
    const tableBody = document.querySelector('#ordersTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    allOrders.forEach(order => {
        const date = order.timestamp ? new Date(order.timestamp).toLocaleDateString() : '---';
        const row = `<tr>
            <td>${order.id.substring(0,8)}</td>
            <td>${order.customer?.nombre || 'N/A'}</td>
            <td>$${(order.total || 0).toFixed(2)}</td>
            <td>${date}</td>
            <td><span class="status-badge">${order.status || 'Pendiente'}</span></td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

function populateCategoryFilters() {
    if (!elements.adminCategoryFilter) return;
    const currentVal = elements.adminCategoryFilter.value;
    elements.adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    allCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        elements.adminCategoryFilter.appendChild(opt);
    });
    elements.adminCategoryFilter.value = currentVal;
}

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (elements.loginForm) elements.loginForm.onsubmit = handleLogin;
    if (elements.btnLogout) elements.btnLogout.onclick = handleLogout;
    
    if (elements.adminSearchInput) {
        elements.adminSearchInput.addEventListener('input', () => {
            currentCardsPage = 1;
            renderCardsTable();
        });
    }

    if (elements.adminCategoryFilter) {
        elements.adminCategoryFilter.addEventListener('change', () => {
            currentCardsPage = 1;
            renderCardsTable();
        });
    }
});
