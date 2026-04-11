// ==========================================================================
// 1. CONFIGURACIÓN Y SERVICIOS DE FIREBASE
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserSessionPersistence, signInWithCustomToken, signInAnonymously
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// CARGA DINÁMICA DE CREDENCIALES (Soluciona el error de invalid-api-key)
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;

// ==========================================================================
// 2. VARIABLES DE ESTADO Y CONTROL DE SESIÓN
// ==========================================================================
let isForcedLogoutDone = false;
let allCards = [], allCategories = [], allSealed = [], allOrders = [];
let pendingDelete = { id: null, type: null }; 
let trendChart = null; 

// Elementos UI Referenciados
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, sealedProductForm, sealedProductModal, categoryForm, categoryModal, quickSearchModal, confirmDeleteModal, alertModal;
let searchStatusMessage, tcgSearchInput, searchSetIdInput, submitSearchBtn;
let cardImagePreview, imagePreviewContainer;

// Forzar logout inicial para asegurar login manual limpio
const forceLogout = async () => {
    try { 
        await signOut(auth); 
        isForcedLogoutDone = true; 
    } catch (e) { 
        isForcedLogoutDone = true; 
    }
};
forceLogout();

// ==========================================================================
// 3. FUNCIONES DE UI Y MODALES
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

function refreshPreviewImage(url) {
    const img = document.getElementById('cardImagePreview');
    const icon = document.getElementById('placeholderIcon');
    const container = document.getElementById('imagePreviewContainer');

    if (url && url.trim() !== "" && url.startsWith('http')) {
        if(img) {
            img.src = url;
            img.style.display = 'block';
        }
        if(icon) icon.style.display = 'none';
        container?.classList.add('active');
    } else {
        if(img) {
            img.src = "";
            img.style.display = 'none';
        }
        if(icon) icon.style.display = 'block';
        container?.classList.remove('active');
    }
}

function toggleSidebar(show) {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    if (show) {
        sidebar?.classList.add('show');
        overlay?.classList.add('show');
    } else {
        sidebar?.classList.remove('show');
        overlay?.classList.remove('show');
    }
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
// 4. LÓGICA DE COMPARACIÓN (MARKET ANALYSIS)
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
            renderComparisonUI(data.data[0]);
            status.textContent = "Análisis completado con éxito.";
        } else {
            status.textContent = "No se hallaron datos en TCGPlayer.";
        }
    } catch (e) {
        status.textContent = "Error de conexión con la API.";
    } finally {
        btn.disabled = false;
    }
}

function renderComparisonUI(card) {
    const resultsDiv = document.getElementById('comparisonResults');
    if(resultsDiv) resultsDiv.style.display = 'block';
    
    let prices = card.tcgplayer?.prices;
    let mainType = ['holofoil', 'reverseHolofoil', 'normal'].find(t => prices && prices[t]);
    let liveMarket = mainType ? (prices[mainType].market || 0) : 0;

    // Si tuviéramos elementos para mostrar precio vivo en la sección de comparativa:
    const tcgPriceEl = document.getElementById('tcgPriceDisplay');
    if(tcgPriceEl) tcgPriceEl.textContent = `$${liveMarket.toFixed(2)}`;

    generateTrendChart(liveMarket);
}

function generateTrendChart(currentPrice) {
    const ctx = document.getElementById('priceTrendChart')?.getContext('2d');
    if(!ctx) return;
    if (trendChart) trendChart.destroy();

    const labels = ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Hoy'];
    const mockHistory = labels.map((_, i) => currentPrice * (1 + (Math.random() * 0.1 - 0.05)));
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
                y: { grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ==========================================================================
// 5. BUSCADOR TCGPLAYER (AUTOCOMPLETADO DE FORMULARIO)
// ==========================================================================

async function handleQuickSearchTCG() {
    const input = document.getElementById('tcgSearchInput');
    const status = document.getElementById('searchStatus');
    const btn = document.getElementById('submitSearch');
    
    if (!input || !input.value.trim()) {
        if(status) status.textContent = "Ingresa el código.";
        return;
    }
    
    btn.disabled = true;
    if(status) {
        status.textContent = "Buscando en TCGPlayer...";
        status.style.color = "#3b82f6";
    }

    let raw = input.value.trim();
    let cardNumber = raw.includes('/') ? raw.split('/')[0].trim() : raw;

    try {
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:"${cardNumber}"`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const card = data.data[0];
            fillCardFormWithTCG(card);
            closeModal(document.getElementById('scannerModal'));
        } else {
            if(status) {
                status.textContent = "No se encontró la carta.";
                status.style.color = "#ef4444";
            }
        }
    } catch (error) { 
        if(status) status.textContent = "Error de red."; 
    } finally { 
        btn.disabled = false; 
    }
}

function fillCardFormWithTCG(card) {
    const modal = document.getElementById('cardModal');
    openModal(modal);
    
    document.getElementById('cardId').value = '';
    document.getElementById('cardName').value = card.name;
    document.getElementById('cardCode').value = `${card.number}/${card.set.printedTotal}`;
    
    const img = card.images.large || card.images.small;
    document.getElementById('cardImage').value = img;
    refreshPreviewImage(img);
    
    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        const cat = ['holofoil', 'reverseHolofoil', 'normal'].find(t => p[t]);
        price = cat ? (p[cat].market || 0) : 0;
    }
    document.getElementById('cardPrice').value = parseFloat(price).toFixed(2);
    document.getElementById('cardStock').value = 1;
}

// ==========================================================================
// 6. CRUD Y CARGA DE DATOS (FIREBASE)
// ==========================================================================

async function handleSaveCard(e) {
    e.preventDefault();
    const id = document.getElementById('cardId').value;
    const nombre = document.getElementById('cardName').value.trim();
    const codigo = document.getElementById('cardCode').value.trim();
    
    // Bloqueo por código duplicado
    if (allCards.find(c => c.codigo.toLowerCase() === codigo.toLowerCase() && c.id !== id)) { 
        showAlert("Código Duplicado", "Ya tienes registrada una carta con el código: " + codigo); 
        return; 
    }

    const data = { 
        nombre, 
        codigo, 
        stock: parseInt(document.getElementById('cardStock').value) || 0,
        precio: parseFloat(document.getElementById('cardPrice').value) || 0,
        imagen_url: document.getElementById('cardImage').value.trim()
    };

    try {
        const path = `artifacts/${appId}/public/data/cards`;
        if (id) await updateDoc(doc(db, path, id), data);
        else await addDoc(collection(db, path), data);
        closeModal(document.getElementById('cardModal')); 
    } catch (err) { showAlert("Error", "No se pudo guardar la carta."); }
}

async function handleSaveSealed(e) {
    e.preventDefault();
    const id = document.getElementById('sealedProductId').value;
    const nombre = document.getElementById('sealedProductName').value.trim();
    const data = { 
        nombre, 
        categoria: document.getElementById('sealedProductCategory').value, 
        precio: parseFloat(document.getElementById('sealedProductPrice').value) || 0, 
        stock: parseInt(document.getElementById('sealedProductStock').value) || 0, 
        imagen_url: document.getElementById('sealedProductImage').value.trim() 
    };
    try {
        const path = `artifacts/${appId}/public/data/sealed_products`;
        if (id) await updateDoc(doc(db, path, id), data);
        else await addDoc(collection(db, path), data);
        closeModal(document.getElementById('sealedProductModal')); 
    } catch (err) { showAlert("Error", "No se pudo guardar."); }
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const nombre = document.getElementById('categoryName').value.trim();
    try {
        const path = `artifacts/${appId}/public/data/categories`;
        if (id) await updateDoc(doc(db, path, id), { name: nombre });
        else await addDoc(collection(db, path), { name: nombre });
        closeModal(document.getElementById('categoryModal')); 
    } catch (err) { showAlert("Error", "No se pudo guardar la categoría."); }
}

function loadAllData() {
    try {
        // Carga de Cartas en Tiempo Real
        const cardsPath = `artifacts/${appId}/public/data/cards`;
        onSnapshot(query(collection(db, cardsPath)), (snap) => {
            allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            filterAndRenderCards();
            updateStats();
        });

        // Carga de Sellados
        const sealedPath = `artifacts/${appId}/public/data/sealed_products`;
        onSnapshot(query(collection(db, sealedPath)), (snap) => {
            allSealed = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderSealedTable();
            updateStats();
        });

        // Carga de Categorías
        const catPath = `artifacts/${appId}/public/data/categories`;
        onSnapshot(query(collection(db, catPath)), (snap) => {
            allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCategoriesTable();
            updateCategorySelects();
        });

        // Carga de Pedidos
        const ordersPath = `artifacts/${appId}/public/data/orders`;
        onSnapshot(query(collection(db, ordersPath)), (snap) => {
            allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderOrdersTable();
        });

    } catch (e) { console.error("Error cargando base de datos:", e); }
}

// ==========================================================================
// 7. RENDERIZADO DE TABLAS
// ==========================================================================

function filterAndRenderCards() {
    const searchTerm = document.getElementById('inventorySearch')?.value.toLowerCase();
    let filtered = allCards;
    if (searchTerm) {
        filtered = allCards.filter(c => 
            c.nombre.toLowerCase().includes(searchTerm) || 
            c.codigo.toLowerCase().includes(searchTerm)
        );
    }
    renderCardsTable(filtered);
}

function renderCardsTable(list) {
    const tbody = document.querySelector('#cardsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #94a3b8;">Sin resultados.</td></tr>';
        return;
    }
    list.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td style="font-weight:700; color:#1e293b;">${c.nombre}</td>
            <td><span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-size:0.8rem;">${c.codigo}</span></td>
            <td style="font-weight:700; color:#3b82f6;">$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock > 0 ? c.stock : '<span style="color:#ef4444; font-weight:700;">0</span>'}</td>
            <td>
                <button class="action-btn edit" data-id="${c.id}" data-type="card"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="card" style="color: #ef4444; margin-left:10px;"><i class="fas fa-trash"></i></button>
            </td>`;
    });
}

function renderSealedTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allSealed.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${p.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td style="font-weight:700;">${p.nombre}</td>
            <td>${p.categoria}</td>
            <td style="font-weight:700; color:#3b82f6;">$${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button class="action-btn edit" data-id="${p.id}" data-type="sealed"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${p.id}" data-type="sealed" style="color: #ef4444; margin-left:10px;"><i class="fas fa-trash"></i></button>
            </td>`;
    });
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight:700;">${c.name}</td>
            <td>
                <button class="action-btn edit" data-id="${c.id}" data-type="category"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="category" style="color: #ef4444; margin-left:10px;"><i class="fas fa-trash"></i></button>
            </td>`;
    });
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>#${o.id.substring(0,6)}</td>
            <td style="font-weight:700;">${o.customerName || 'Invitado'}</td>
            <td style="font-weight:700; color:#10b981;">$${parseFloat(o.total || 0).toFixed(2)}</td>
            <td><span class="status-badge ${o.status || 'pendiente'}">${o.status || 'pendiente'}</span></td>
            <td><button class="action-btn view-order" data-id="${o.id}"><i class="fas fa-eye"></i></button></td>`;
    });
}

function updateCategorySelects() {
    const selects = [document.getElementById('cardCategory'), document.getElementById('sealedProductCategory')];
    selects.forEach(sel => { 
        if(sel) { 
            sel.innerHTML = '<option value="" disabled selected>Selecciona una opción</option>'; 
            allCategories.forEach(c => sel.appendChild(new Option(c.name, c.name))); 
        } 
    });
}

function updateStats() {
    const totalCards = document.getElementById('totalCardsCount');
    const totalSealed = document.getElementById('sealedCount');
    const outStock = document.getElementById('outOfStockCount');
    if(totalCards) totalCards.textContent = allCards.length;
    if(totalSealed) totalSealed.textContent = allSealed.length;
    if(outStock) outStock.textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

// ==========================================================================
// 8. INICIALIZACIÓN FINAL Y EVENTOS
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Referencias de elementos cargados tras DOM
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

    // Navegación lateral
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showSection(link.dataset.section); 
    }));

    // Buscador de inventario dinámico
    document.getElementById('inventorySearch')?.addEventListener('input', filterAndRenderCards);
    
    // Comparativa en vivo
    document.getElementById('btnCompareSearch')?.addEventListener('click', handleMarketComparison);

    // Login Form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const btn = document.getElementById('loginBtnSubmit');
        const msg = document.getElementById('loginMessage');
        try {
            btn.disabled = true; btn.textContent = "Verificando...";
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) {
            btn.disabled = false; btn.textContent = "Iniciar Sesión";
            if(msg) {
                msg.textContent = "Error: Credenciales no válidas.";
                msg.style.display = "block";
            }
        }
    });

    // Submits de Formularios de Gestión
    cardForm?.addEventListener('submit', handleSaveCard);
    document.getElementById('sealedProductForm')?.addEventListener('submit', handleSaveSealed);
    document.getElementById('categoryForm')?.addEventListener('submit', handleSaveCategory);

    // Botones de Apertura de Modales
    document.getElementById('addCardBtn')?.addEventListener('click', () => { 
        cardForm.reset(); document.getElementById('cardId').value = ''; 
        refreshPreviewImage(""); openModal(cardModal); 
    });
    
    document.getElementById('openScannerBtn')?.addEventListener('click', () => {
        openModal(document.getElementById('scannerModal'));
    });

    // Delegación de eventos para botones de Acción (Editar/Borrar/Ver)
    document.body.addEventListener('click', async (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        const id = btn.dataset.id;
        const type = btn.dataset.type;

        // BOTONES DE EDICIÓN
        if (btn.classList.contains('edit')) {
            if (type === 'card') {
                const d = allCards.find(x => x.id === id);
                document.getElementById('cardId').value = d.id; 
                document.getElementById('cardName').value = d.nombre; 
                document.getElementById('cardCode').value = d.codigo; 
                document.getElementById('cardStock').value = d.stock; 
                document.getElementById('cardPrice').value = d.precio; 
                document.getElementById('cardImage').value = d.imagen_url; 
                refreshPreviewImage(d.imagen_url); 
                openModal(document.getElementById('cardModal'));
            } else if (type === 'sealed') {
                const d = allSealed.find(x => x.id === id);
                document.getElementById('sealedProductId').value = d.id;
                document.getElementById('sealedProductName').value = d.nombre;
                document.getElementById('sealedProductCategory').value = d.categoria;
                document.getElementById('sealedProductPrice').value = d.precio;
                document.getElementById('sealedProductStock').value = d.stock;
                document.getElementById('sealedProductImage').value = d.imagen_url;
                openModal(document.getElementById('sealedProductModal'));
            } else if (type === 'category') {
                const d = allCategories.find(x => x.id === id);
                document.getElementById('categoryId').value = d.id;
                document.getElementById('categoryName').value = d.name;
                openModal(document.getElementById('categoryModal'));
            }
        }

        // BOTONES DE ELIMINACIÓN
        if (btn.classList.contains('delete')) { 
            if(confirm("¿Estás seguro de que deseas eliminar este elemento?")) {
                const collectionMap = { 'card': 'cards', 'sealed': 'sealed_products', 'category': 'categories' };
                const col = collectionMap[type];
                try {
                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/${col}`, id));
                } catch(err) { showAlert("Error", "No se pudo eliminar."); }
            }
        }

        // VER DETALLES DE PEDIDO
        if (btn.classList.contains('view-order')) {
            const order = allOrders.find(o => o.id === id);
            if(order) {
                showAlert("Detalles del Pedido", `Cliente: ${order.customerName}\nTotal: $${order.total}\nEstado: ${order.status}`);
            }
        }
    });

    // Botones de cierre y otros
    document.getElementById('btnAlertAccept')?.addEventListener('click', () => closeModal(alertModal));
    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.admin-modal'))));
    document.getElementById('cardImage')?.addEventListener('input', (e) => refreshPreviewImage(e.target.value));
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));

    // Inyección del Buscador TCG en el modal de scanner
    const quickSearchContent = document.getElementById('quickSearchContent');
    if(quickSearchContent) {
        quickSearchContent.innerHTML = `
            <button class="close-button" id="closeScannerX">&times;</button>
            <h2 style="font-weight:800; margin-bottom:20px; color:#1e293b;"><i class="fas fa-search"></i> Buscador TCGPlayer</h2>
            <div class="form-group">
                <label style="font-size:0.75rem; font-weight:700; color:#64748b; text-transform:uppercase;">Código de Carta (ej: 028/151)</label>
                <input type="text" id="tcgSearchInput" placeholder="Número de carta..." style="width:100%; padding:14px; border:2px solid #e2e8f0; border-radius:15px; outline:none; margin-top:5px;">
            </div>
            <button id="submitSearch" class="confirm-button" style="width:100%; margin-top:10px; padding:16px;">Consultar Datos</button>
            <p id="searchStatus" style="margin-top:15px; font-size:0.85rem; text-align:center;"></p>
        `;
        document.getElementById('submitSearch').onclick = handleQuickSearchTCG;
        document.getElementById('closeScannerX').onclick = () => closeModal(document.getElementById('scannerModal'));
    }

    // Estado inicial de Auth del entorno
    onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous && isForcedLogoutDone) {
            if(loginView) loginView.style.display = 'none';
            if(adminView) adminView.style.display = 'flex';
            loadAllData();
        } else {
            if(adminView) adminView.style.display = 'none';
            if(loginView) loginView.style.display = 'flex';
        }
    });

    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
    };
    initAuth();
});
