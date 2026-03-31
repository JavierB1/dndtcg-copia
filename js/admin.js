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
    apiKey: "", // Inyectada por el entorno
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

let isForcedLogoutDone = false;
signOut(auth).then(() => { isForcedLogoutDone = true; });

let allCards = [], allSealed = [], allCategories = [], allOrders = [];
const itemsPerPage = 10;
let currentCardsPage = 1;

let loginView, adminView, sidebarMenu, sidebarOverlay;
let searchCardNumberInput, searchSetIdInput, submitSearchBtn, searchStatusMessage;

// ==========================================================================
// 2. FUNCIONES DE UI Y NAVEGACIÓN
// ==========================================================================
function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

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

    // Cerrar automáticamente en iPads y móviles al navegar
    if(window.innerWidth <= 1024) {
        toggleSidebar(false);
    }
}

// ==========================================================================
// 3. CARGA Y RENDERIZADO (RESTAURADO)
// ==========================================================================
async function loadAllData() {
    try {
        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        
        const selects = ['cardCategory', 'sealedProductCategory'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.innerHTML = '<option value="" disabled selected>Categoría</option>';
                allCategories.forEach(c => el.appendChild(new Option(c.name, c.name)));
            }
        });

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

function updateStats() {
    document.getElementById('totalCardsCount').textContent = allCards.length;
    document.getElementById('totalSealedProductsCount').textContent = allSealed.length;
    document.getElementById('uniqueCategoriesCount').textContent = allCategories.length;
    document.getElementById('outOfStockCount').textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const start = (currentCardsPage - 1) * itemsPerPage;
    allCards.slice(start, start + itemsPerPage).forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td class="action-buttons"><button class="action-btn edit" data-id="${c.id}" data-type="card"><i class="fas fa-edit"></i></button></td>
        `;
    });
    document.getElementById('adminPageInfo').textContent = `Página ${currentCardsPage}`;
}

function renderSealedTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allSealed.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><img src="${p.imagen_url}" width="40"></td><td><strong>${p.nombre}</strong></td><td>${p.categoria}</td><td>$${parseFloat(p.precio).toFixed(2)}</td><td>${p.stock}</td><td><button class="action-btn edit" data-id="${p.id}" data-type="sealed"><i class="fas fa-edit"></i></button></td>`;
    });
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><strong>${c.name}</strong></td><td><button class="action-btn edit" data-id="${c.id}" data-type="category"><i class="fas fa-edit"></i></button></td>`;
    });
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${o.id.substring(0,8)}</td><td>${new Date(o.timestamp).toLocaleDateString()}</td><td>${o.customerName}</td><td>$${parseFloat(o.total).toFixed(2)}</td><td><span class="status-badge ${o.status}">${o.status}</span></td><td><button class="action-btn"><i class="fas fa-eye"></i></button></td>`;
    });
}

// ==========================================================================
// 4. INICIALIZACIÓN Y EVENTOS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loginView = document.getElementById('loginModal');
    adminView = document.querySelector('.admin-container');
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');

    // Hamburger y Cierre Lateral
    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('closeSidebarBtn')?.addEventListener('click', () => toggleSidebar(false));
    sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));

    // Navegación
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(link.dataset.section);
        });
    });

    // Login
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        try {
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) { alert("Credenciales incorrectas"); }
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

    // Modal Buscador
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2>Buscador TCG</h2>
            <div style="margin:15px 0; text-align:left;">
                <label>Número (ej: 028/151)</label>
                <input type="text" id="searchCardNumber" placeholder="028/151" style="width:100%; padding:12px; border-radius:8px; border:1px solid #ddd;">
            </div>
            <button id="submitSearch" style="width:100%; padding:15px; background:#3182ce; color:white; border:none; border-radius:8px; font-weight:bold;">Buscar</button>
            <p id="searchStatus" style="margin-top:15px;"></p>
        `;
        searchCardNumberInput = document.getElementById('searchCardNumber');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', async () => {
            // Lógica de búsqueda TCGPlayer aquí...
        });
    }

    // Botones Globales
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(document.getElementById('scannerModal')));
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => { signOut(auth).then(() => location.reload()); });

    // Delegación para cerrar modales
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-button') || e.target.classList.contains('admin-modal')) {
            closeModal(document.getElementById('scannerModal'));
            closeModal(document.getElementById('cardModal'));
        }
    });
});
