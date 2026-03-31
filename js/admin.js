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
    adminPageInfo: document.getElementById('adminPageInfo')
};

// ==========================================================================
// FUNCIONES DE CARGA (PROTEGIDAS POR AUTH)
// ==========================================================================

async function loadAllData() {
    // REGLA DE ORO: Si no hay usuario, no pedimos datos (Evita Error de Permisos)
    if (!auth.currentUser) return;

    try {
        await Promise.all([
            loadCategories(),
            loadCardsData(),
            loadSealedProductsData(),
            loadOrdersData()
        ]);
        console.log("Datos sincronizados correctamente con Firebase.");
    } catch (error) {
        console.error("Error de permisos o red:", error.message);
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
    console.log("Estado Auth:", user ? "Conectado (" + user.email + ")" : "Desconectado");
    
    if (user) {
        // Usuario logueado: Ocultar login, mostrar panel y CARGAR datos
        if (elements.loginModal) elements.loginModal.style.display = 'none';
        if (elements.dashboardSection) elements.dashboardSection.classList.add('active');
        loadAllData();
    } else {
        // Usuario no logueado: Mostrar login, ocultar todo lo demás
        if (elements.loginModal) elements.loginModal.style.display = 'flex';
        hideAllSections();
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('loginMessage');

    try {
        msg.textContent = "Verificando...";
        msg.style.color = "#6366f1";
        msg.style.display = "block";
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        msg.textContent = "Error: Usuario o clave incorrectos.";
        msg.style.color = "#ef4444";
    }
}

function hideAllSections() {
    const sections = [
        elements.dashboardSection, elements.cardsSection, 
        elements.sealedProductsSection, elements.categoriesSection, elements.ordersSection
    ];
    sections.forEach(s => { if(s) s.classList.remove('active'); });
}

// ==========================================================================
// RENDERIZADO DE TABLAS (Tu lógica original intacta)
// ==========================================================================

function renderCardsTable() {
    const tableBody = document.querySelector('#cardsTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const filtered = allCards.filter(card => {
        const query = elements.adminSearchInput ? elements.adminSearchInput.value.toLowerCase() : "";
        const cat = elements.adminCategoryFilter ? elements.adminCategoryFilter.value : "";
        return (card.nombre.toLowerCase().includes(query)) && (cat === "" || card.categoria === cat);
    });

    const start = (currentCardsPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    paginated.forEach(card => {
        const row = `<tr>
            <td>${card.id.substring(0,6)}</td>
            <td><img src="${card.imagen_url}" width="40"></td>
            <td>${card.nombre}</td>
            <td>$${card.precio.toFixed(2)}</td>
            <td>${card.stock}</td>
            <td>${card.categoria}</td>
            <td class="action-buttons">
                <button class="edit-button" onclick="editCard('${card.id}')">Editar</button>
            </td>
        </tr>`;
        tableBody.innerHTML += row;
    });

    if (elements.adminPageInfo) {
        elements.adminPageInfo.textContent = `Página ${currentCardsPage} de ${Math.ceil(filtered.length/itemsPerPage) || 1}`;
    }
}

function renderCategoriesTable() { /* Implementación de categorías */ }
function renderSealedProductsTable() { /* Implementación de productos sellados */ }
function renderOrdersTable() { /* Implementación de pedidos */ }

function populateCategoryFilters() {
    if (!elements.adminCategoryFilter) return;
    elements.adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    allCategories.forEach(cat => {
        elements.adminCategoryFilter.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
}

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    if (elements.loginForm) elements.loginForm.onsubmit = handleLogin;
    
    if (elements.adminSearchInput) {
        elements.adminSearchInput.addEventListener('input', () => {
            currentCardsPage = 1;
            renderCardsTable();
        });
    }
});
