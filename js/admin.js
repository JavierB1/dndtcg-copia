// ==========================================================================
// 1. CONFIGURACIÓN Y SERVICIOS DE FIREBASE
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserSessionPersistence, signInWithCustomToken, signInAnonymously
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
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;

// ==========================================================================
// 2. CONTROL DE SESIÓN
// ==========================================================================
let isForcedLogoutDone = false;
const forceLogout = async () => {
    try { await signOut(auth); isForcedLogoutDone = true; } catch (e) { isForcedLogoutDone = true; }
};
forceLogout();

// Variables Globales de Estado
let allCards = [], allCategories = [], allSealed = [], allOrders = [];
let pendingDelete = { id: null, type: null }; 
let trendChart = null; // Para el gráfico de Chart.js

// Elementos UI
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, sealedProductForm, sealedProductModal, categoryForm, categoryModal, quickSearchModal, confirmDeleteModal, alertModal;
let searchStatusMessage, tcgSearchInput, searchSetIdInput, submitSearchBtn;
let cardImagePreview, imagePreviewContainer;

// ==========================================================================
// 3. FUNCIONES DE UI
// ==========================================================================

function openModal(m) { 
    if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } 
}

function closeModal(m) { 
    if(m){ m.style.display='none'; document.body.style.overflow=''; } 
}

function showAlert(title, message) {
    const t = document.getElementById('alertTitle');
    const m = document.getElementById('alertText');
    if (t) t.textContent = title;
    if (m) m.textContent = message;
    openModal(alertModal);
}

function toggleSidebar(show) {
    if (show) { sidebarMenu?.classList.add('show'); sidebarOverlay?.classList.add('show'); } 
    else { sidebarMenu?.classList.remove('show'); sidebarOverlay?.classList.remove('show'); }
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if(activeLink) activeLink.classList.add('active');
    
    const titleEl = document.getElementById('main-title');
    const titles = { 
        'dashboard-section': 'Dashboard', 
        'comparison-section': 'Comparativa de Mercado',
        'cards-section': 'Gestión de Cartas', 
        'sealed-products-section': 'Productos Sellados', 
        'categories-section': 'Categorías', 
        'orders-section': 'Pedidos' 
    };
    if(titleEl) titleEl.textContent = titles[sectionId] || 'Panel';
    if(window.innerWidth <= 768) toggleSidebar(false);
}

// ==========================================================================
// 4. LÓGICA DE COMPARACIÓN (LIVE MARKET)
// ==========================================================================

async function handleMarketComparison() {
    const input = document.getElementById('compSearchInput');
    const status = document.getElementById('compStatus');
    const btn = document.getElementById('btnCompareSearch');
    let raw = input.value.trim();
    
    if (!raw) { status.textContent = "Ingresa un código (ej: 028/151)"; return; }

    status.textContent = "Analizando datos globales...";
    btn.disabled = true;

    let cardNumber = raw.includes('/') ? raw.split('/')[0].trim() : raw;

    try {
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:"${cardNumber}"`);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const card = data.data[0];
            renderComparison(card);
            status.textContent = "Análisis completado con éxito.";
        } else {
            status.textContent = "No se encontró información en TCGPlayer.";
        }
    } catch (e) {
        status.textContent = "Error de conexión.";
    } finally {
        btn.disabled = false;
    }
}

function renderComparison(card) {
    document.getElementById('comparisonResults').style.display = 'block';
    
    // 1. Datos TCGPlayer Live
    let prices = card.tcgplayer?.prices;
    let mainType = ['holofoil', 'reverseHolofoil', 'normal'].find(t => prices && prices[t]);
    let liveMarket = mainType ? (prices[mainType].market || 0) : 0;
    let liveLow = mainType ? (prices[mainType].low || 0) : 0;
    let liveHigh = mainType ? (prices[mainType].high || 0) : 0;

    document.getElementById('tcgPriceDisplay').textContent = `$${liveMarket.toFixed(2)}`;
    document.getElementById('tcgLowDisplay').textContent = `$${liveLow.toFixed(2)}`;
    document.getElementById('tcgHighDisplay').textContent = `$${liveHigh.toFixed(2)}`;

    // 2. Datos Local (Mi Tienda)
    const localCard = allCards.find(c => c.nombre.toLowerCase() === card.name.toLowerCase());
    if (localCard) {
        document.getElementById('myCardInfo').style.display = 'block';
        document.getElementById('myCardEmpty').style.display = 'none';
        document.getElementById('myPriceDisplay').textContent = `$${parseFloat(localCard.precio).toFixed(2)}`;
        document.getElementById('myStockDisplay').textContent = `Stock: ${localCard.stock} unidades`;
        
        // Color basado en competitividad
        if (localCard.precio > liveMarket) document.getElementById('myPriceDisplay').style.color = '#ef4444';
        else if (localCard.precio < liveMarket) document.getElementById('myPriceDisplay').style.color = '#10b981';
        else document.getElementById('myPriceDisplay').style.color = '#3b82f6';
    } else {
        document.getElementById('myCardInfo').style.display = 'none';
        document.getElementById('myCardEmpty').style.display = 'block';
    }

    // 3. Generar Gráfico de Tendencia (Simulado)
    generateTrendChart(liveMarket);
}

function generateTrendChart(currentPrice) {
    const ctx = document.getElementById('priceTrendChart').getContext('2d');
    
    if (trendChart) trendChart.destroy();

    // Simulamos datos de los últimos 7 días
    const labels = ['Hace 7d', 'Hace 6d', 'Hace 5d', 'Hace 4d', 'Hace 3d', 'Hace 2d', 'Hoy'];
    const mockHistory = labels.map((_, i) => {
        const factor = 1 + (Math.random() * 0.1 - 0.05); // +/- 5%
        return currentPrice * factor;
    });
    mockHistory[6] = currentPrice;

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Precio de Mercado ($)',
                data: mockHistory,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ==========================================================================
// 5. CRUD Y CARGA DE DATOS
// ==========================================================================

async function loadAllData() {
    try {
        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        const sealedSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'));
        allSealed = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedTable();

        const orderSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrdersTable();
        updateStats();
    } catch (e) { console.error(e); }
}

// ... (Resto de funciones de renderizado similares a las anteriores para mantener consistencia)

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td><td><strong>${c.nombre}</strong></td><td>${c.codigo}</td><td>${c.expansion || '-'}</td><td>$${parseFloat(c.precio).toFixed(2)}</td><td>${c.stock}</td><td class="action-buttons"><button class="action-btn edit" data-id="${c.id}" data-type="card"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-id="${c.id}" data-type="card" style="color: #ef4444;"><i class="fas fa-trash"></i></button></td>`;
    });
}

function renderSealedTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allSealed.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><img src="${p.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td><td><strong>${p.nombre}</strong></td><td>${p.categoria}</td><td>$${parseFloat(p.precio).toFixed(2)}</td><td>${p.stock}</td><td class="action-buttons"><button class="action-btn edit" data-id="${p.id}" data-type="sealed"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-id="${p.id}" data-type="sealed" style="color: #ef4444;"><i class="fas fa-trash"></i></button></td>`;
    });
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><strong>${c.name}</strong></td><td class="action-buttons"><button class="action-btn edit" data-id="${c.id}" data-type="category"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-id="${c.id}" data-type="category" style="color: #ef4444;"><i class="fas fa-trash"></i></button></td>`;
    });
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${o.id.substring(0,8)}</td><td>${o.customerName || 'Invitado'}</td><td>$${parseFloat(o.total || 0).toFixed(2)}</td><td><span class="status-badge ${o.status || 'pendiente'}">${o.status || 'pendiente'}</span></td><td><button class="action-btn view-order" data-id="${o.id}"><i class="fas fa-eye"></i></button></td>`;
    });
}

function updateStats() {
    const el1 = document.getElementById('totalCardsCount'); if(el1) el1.textContent = allCards.length;
    const el2 = document.getElementById('totalSealedProductsCount'); if(el2) el2.textContent = allSealed.length;
    const el3 = document.getElementById('uniqueCategoriesCount'); if(el3) el3.textContent = allCategories.length;
    const el4 = document.getElementById('outOfStockCount'); if(el4) el4.textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

// ==========================================================================
// 6. INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    loginView = document.getElementById('loginModal'); 
    adminView = document.getElementById('adminContainer'); 
    sidebarMenu = document.getElementById('sidebarMenu'); 
    sidebarOverlay = document.getElementById('sidebarOverlay');
    alertModal = document.getElementById('alertModal');
    confirmDeleteModal = document.getElementById('confirmDeleteModal');
    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardImagePreview = document.getElementById('cardImagePreview');
    imagePreviewContainer = document.querySelector('.image-preview-container');

    // Navegación
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showSection(link.dataset.section); 
    }));

    // Sidebar móvil
    document.getElementById('openSidebar')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('closeSidebar')?.addEventListener('click', () => toggleSidebar(false));
    sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));

    // Botón Comparar
    document.getElementById('btnCompareSearch')?.addEventListener('click', handleMarketComparison);

    // Auth Listeners
    onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous && isForcedLogoutDone) { 
            loginView.style.display = 'none'; adminView.style.display = 'flex'; loadAllData(); 
        } else { 
            adminView.style.display = 'none'; loginView.style.display = 'flex'; 
        }
    });

    // Login Form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const btn = document.getElementById('loginBtnSubmit');
        try {
            btn.disabled = true; btn.textContent = "Accediendo...";
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) {
            btn.disabled = false; btn.textContent = "Acceder";
            document.getElementById('loginMessage').textContent = "Error de credenciales.";
            document.getElementById('loginMessage').style.display = "block";
        }
    });

    // Modales y Cerrar
    document.getElementById('btnAlertAccept')?.addEventListener('click', () => closeModal(alertModal));
    document.getElementById('btnCancelDelete')?.addEventListener('click', () => closeModal(confirmDeleteModal));
    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.admin-modal'))));

    // Logout
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));

    // Init Auth
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
    };
    initAuth();
});
