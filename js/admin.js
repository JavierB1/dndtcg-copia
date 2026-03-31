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

// Forzar cierre al inicio para login manual
let isForcedLogoutDone = false;
signOut(auth).then(() => { isForcedLogoutDone = true; });

let allCards = [], allSealed = [], allCategories = [], allOrders = [];
const itemsPerPage = 10;
let currentCardsPage = 1;

// Referencias UI
let loginView, adminView, sidebarMenu, sidebarOverlay;
let searchCardNumberInput, searchSetIdInput, submitSearchBtn, searchStatusMessage;

// ==========================================================================
// 2. FUNCIONES DE UI Y NAVEGACIÓN
// ==========================================================================
function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if(activeLink) activeLink.classList.add('active');

    if(window.innerWidth < 1024) {
        sidebarMenu?.classList.remove('show');
        if(sidebarOverlay) sidebarOverlay.style.display='none';
    }
}

// ==========================================================================
// 3. CARGA Y RENDERIZADO DE DATOS
// ==========================================================================
async function loadAllData() {
    try {
        // Categorías
        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        
        const selects = ['cardCategory', 'sealedProductCategory'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.innerHTML = '<option value="" disabled selected>Selecciona Categoría</option>';
                allCategories.forEach(c => el.appendChild(new Option(c.name, c.name)));
            }
        });

        // Cartas
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        // Sellados
        const sealedSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'));
        allSealed = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedTable();

        // Pedidos
        const orderSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp);
        renderOrdersTable();

        updateStats();
    } catch (e) { console.error("Error cargando datos:", e); }
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
    const paginated = allCards.slice(start, start + itemsPerPage);
    paginated.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${c.id}" data-type="card"><i class="fas fa-edit"></i></button>
            </td>
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
        row.innerHTML = `
            <td><img src="${p.imagen_url}" width="40" style="border-radius:4px"></td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria}</td>
            <td>$${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${p.id}" data-type="sealed"><i class="fas fa-edit"></i></button>
            </td>
        `;
    });
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
                <button class="action-btn edit" data-id="${c.id}" data-type="category"><i class="fas fa-edit"></i></button>
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
            <td><button class="action-btn" onclick="alert('Ver detalles en consola')"><i class="fas fa-eye"></i></button></td>
        `;
    });
}

// ==========================================================================
// 4. LÓGICA DE BÚSQUEDA TCGPLAYER
// ==========================================================================
async function handleQuickSearch() {
    let rawInput = searchCardNumberInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();
    if (!rawInput) return;

    let cardNumber = rawInput.includes('/') ? rawInput.split('/')[0].trim() : rawInput;
    let totalHint = rawInput.includes('/') ? rawInput.split('/')[1].trim() : null;

    searchStatusMessage.textContent = "Buscando...";
    submitSearchBtn.disabled = true;

    try {
        let query = `number:"${cardNumber}"`;
        if (setIdInput) query += ` (set.id:"${setIdInput}*" OR set.name:"${setIdInput}*")`;
        const resp = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}`);
        const data = await resp.json();

        if (data.data && data.data.length > 0) {
            let card = totalHint ? data.data.find(c => c.set.printedTotal == totalHint) : data.data[0];
            if (!card) card = data.data[0];
            
            openModal(document.getElementById('cardModal'));
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
            
            closeModal(document.getElementById('scannerModal'));
        } else { searchStatusMessage.textContent = "Sin resultados."; }
    } catch (e) { searchStatusMessage.textContent = "Error."; }
    finally { submitSearchBtn.disabled = false; }
}

// ==========================================================================
// 5. INICIALIZACIÓN Y EVENTOS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loginView = document.getElementById('loginModal');
    adminView = document.querySelector('.admin-container');

    // Navegación Sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(link.dataset.section);
        });
    });

    // Logout
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
        signOut(auth).then(() => location.reload());
    });

    // Login Form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        try {
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) { alert("Error de acceso"); }
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

    // Buscador
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2>Buscador TCG</h2>
            <div style="margin-bottom:15px; text-align:left;">
                <label>Número de Carta (ej: 028/151)</label>
                <input type="text" id="searchCardNumber" placeholder="Número..." style="width:100%; padding:12px; border-radius:8px; border:1px solid #ddd;">
            </div>
            <div style="margin-bottom:20px; text-align:left;">
                <label>Expansión (opcional)</label>
                <input type="text" id="searchSetId" placeholder="Ej: 151" style="width:100%; padding:12px; border-radius:8px; border:1px solid #ddd;">
            </div>
            <button id="submitSearch" style="width:100%; padding:15px; background:#3182ce; color:white; border:none; border-radius:8px; font-weight:bold;">Buscar</button>
            <p id="searchStatus" style="margin-top:15px;"></p>
        `;
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
    }

    // Eventos Globales de Botones
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(document.getElementById('scannerModal')));
    document.getElementById('addCardBtn')?.addEventListener('click', () => { 
        document.getElementById('cardForm').reset(); 
        document.getElementById('cardId').value = ''; 
        openModal(document.getElementById('cardModal')); 
    });
    document.getElementById('addSealedProductBtn')?.addEventListener('click', () => { 
        document.getElementById('sealedProductForm').reset(); 
        document.getElementById('sealedProductId').value = ''; 
        openModal(document.getElementById('sealedProductModal')); 
    });
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => { 
        document.getElementById('categoryForm').reset(); 
        document.getElementById('categoryId').value = ''; 
        openModal(document.getElementById('categoryModal')); 
    });

    // Paginación Cartas
    document.getElementById('adminPrevPageBtn')?.addEventListener('click', () => { if(currentCardsPage > 1) { currentCardsPage--; renderCardsTable(); } });
    document.getElementById('adminNextPageBtn')?.addEventListener('click', () => { if(currentCardsPage * itemsPerPage < allCards.length) { currentCardsPage++; renderCardsTable(); } });

    // Delegación para Editar
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit');
        if(!btn) return;
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        
        if(type === 'card') {
            const data = allCards.find(x => x.id === id);
            document.getElementById('cardId').value = data.id;
            document.getElementById('cardName').value = data.nombre;
            document.getElementById('cardCode').value = data.codigo;
            document.getElementById('cardExpansion').value = data.expansion || '';
            document.getElementById('cardImage').value = data.imagen_url;
            document.getElementById('cardPrice').value = data.precio;
            document.getElementById('cardStock').value = data.stock;
            document.getElementById('cardCategory').value = data.categoria;
            openModal(document.getElementById('cardModal'));
        }
    });

    // Cerrar modales
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('close-button') || e.target.classList.contains('admin-modal')) {
            document.querySelectorAll('.admin-modal').forEach(m => closeModal(m));
        }
    });
});
