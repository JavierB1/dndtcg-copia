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
let currentCardsPage = 1;
const itemsPerPage = 10;

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
    btnLogout: document.getElementById('btnLogout'),
    mainContent: document.querySelector('.main-content'),
    sidebar: document.querySelector('.sidebar')
};

// ==========================================================================
// GESTIÓN DE INTERFAZ Y NAVEGACIÓN
// ==========================================================================

function hideAllSections() {
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
}

function showSection(sectionId) {
    hideAllSections();
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
}

/**
 * Control crítico de visibilidad inicial.
 * Bloquea la interfaz hasta que auth responda.
 */
function setInitialUIState(isAuthenticated) {
    if (isAuthenticated) {
        // Usuario logueado: Mostrar app, ocultar modal
        if (elements.loginModal) elements.loginModal.style.setProperty('display', 'none', 'important');
        if (elements.sidebar) elements.sidebar.style.display = 'flex';
        if (elements.mainContent) elements.mainContent.style.display = 'block';
        showSection('dashboard-section');
    } else {
        // Usuario no logueado: Ocultar todo, forzar modal
        if (elements.sidebar) elements.sidebar.style.display = 'none';
        if (elements.mainContent) elements.mainContent.style.display = 'none';
        hideAllSections();
        if (elements.loginModal) {
            elements.loginModal.style.setProperty('display', 'flex', 'important');
            elements.loginModal.style.visibility = 'visible';
            elements.loginModal.style.opacity = '1';
        }
    }
}

// ==========================================================================
// FUNCIONES DE CARGA DE DATOS
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
    } catch (error) {
        console.error("Error en carga masiva:", error);
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
// AUTENTICACIÓN
// ==========================================================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Acceso autorizado:", user.email);
        setInitialUIState(true);
        loadAllData();
    } else {
        console.log("Acceso restringido: Mostrando Login.");
        setInitialUIState(false);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const msg = elements.loginMessage;

    try {
        if(msg) {
            msg.textContent = "Verificando credenciales...";
            msg.style.display = "block";
            msg.style.color = "#6366f1";
        }
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if(msg) {
            msg.textContent = "Error: Usuario o contraseña incorrectos.";
            msg.style.color = "#ef4444";
        }
        console.error("Auth Error:", error.code);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// ==========================================================================
// RENDERIZADO DE COMPONENTES
// ==========================================================================

function updateDashboardStats() {
    const c = document.getElementById('stat-total-cards');
    const s = document.getElementById('stat-total-stock');
    const o = document.getElementById('stat-total-orders');

    if (c) c.textContent = allCards.length;
    if (s) s.textContent = allCards.reduce((acc, card) => acc + (card.stock || 0), 0);
    if (o) o.textContent = allOrders.length;
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = elements.adminSearchInput?.value.toLowerCase() || "";
    const cat = elements.adminCategoryFilter?.value || "";

    const filtered = allCards.filter(card => 
        card.nombre.toLowerCase().includes(query) && (cat === "" || card.categoria === cat)
    );

    filtered.slice((currentCardsPage - 1) * itemsPerPage, currentCardsPage * itemsPerPage).forEach(card => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${card.id.substring(0, 6)}</td>
            <td><img src="${card.imagen_url || ''}" onerror="this.src='https://via.placeholder.com/40'"></td>
            <td>${card.nombre}</td>
            <td>$${card.precio.toFixed(2)}</td>
            <td>${card.stock}</td>
            <td>${card.categoria}</td>
            <td class="action-buttons">
                <button class="edit-button">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allCategories.map(cat => `
        <tr>
            <td>${cat.id.substring(0,6)}</td>
            <td>${cat.name}</td>
            <td><button class="delete-category-button">Eliminar</button></td>
        </tr>
    `).join('');
}

function renderSealedProductsTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allSealedProducts.map(prod => `
        <tr>
            <td>${prod.id.substring(0,6)}</td>
            <td>${prod.nombre}</td>
            <td>$${prod.precio.toFixed(2)}</td>
            <td>${prod.stock}</td>
            <td><button class="edit-button">Editar</button></td>
        </tr>
    `).join('');
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allOrders.map(order => `
        <tr>
            <td>${order.id.substring(0,8)}</td>
            <td>${order.customer?.nombre || 'Anónimo'}</td>
            <td>$${(order.total || 0).toFixed(2)}</td>
            <td><span class="status-badge">${order.status || 'Pendiente'}</span></td>
        </tr>
    `).join('');
}

function populateCategoryFilters() {
    if (!elements.adminCategoryFilter) return;
    elements.adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>' + 
        allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

// ==========================================================================
// INICIALIZACIÓN DE EVENTOS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Estado inicial de seguridad: Ocultar todo hasta que Firebase hable
    setInitialUIState(false);

    if (elements.loginForm) elements.loginForm.onsubmit = handleLogin;
    if (elements.btnLogout) elements.btnLogout.onclick = handleLogout;

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            const sectionId = link.getAttribute('href')?.replace('#', '');
            if (sectionId && sectionId !== 'logout') {
                e.preventDefault();
                showSection(sectionId);
                document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });
});
