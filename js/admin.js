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
    apiKey: "", // La API KEY se inyecta automáticamente en el entorno
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
let trendChart = null; // Instancia de Chart.js

// Elementos UI
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, sealedProductForm, sealedProductModal, categoryForm, categoryModal, quickSearchModal, confirmDeleteModal, alertModal;
let searchStatusMessage, tcgSearchInput, searchSetIdInput, submitSearchBtn;
let cardImagePreview, imagePreviewContainer;

// ==========================================================================
// 3. FUNCIONES DE UI Y MODALES
// ==========================================================================

function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

function showAlert(title, message) {
    const t = document.getElementById('alertTitle');
    const m = document.getElementById('alertText');
    if (t) t.textContent = title;
    if (m) m.textContent = message;
    openModal(alertModal);
}

function refreshPreviewImage(url) {
    if (url && url.trim() !== "" && url.startsWith('http')) {
        if(cardImagePreview) cardImagePreview.src = url;
        imagePreviewContainer?.classList.add('active');
    } else {
        if(cardImagePreview) cardImagePreview.src = "";
        imagePreviewContainer?.classList.remove('active');
    }
}

function clearSearchInputs() {
    if (tcgSearchInput) tcgSearchInput.value = '';
    if (searchSetIdInput) searchSetIdInput.value = '';
    if (searchStatusMessage) searchStatusMessage.textContent = '';
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
// 4. LÓGICA DE COMPARACIÓN Y BÚSQUEDA TCGPLAYER
// ==========================================================================

// Buscador para la sección de Comparativa
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
            renderComparison(data.data[0]);
            status.textContent = "Análisis completado.";
        } else {
            status.textContent = "No se hallaron datos en TCGPlayer.";
        }
    } catch (e) {
        status.textContent = "Error de conexión con la API.";
    } finally {
        btn.disabled = false;
    }
}

function renderComparison(card) {
    document.getElementById('comparisonResults').style.display = 'block';
    
    let prices = card.tcgplayer?.prices;
    let mainType = ['holofoil', 'reverseHolofoil', 'normal'].find(t => prices && prices[t]);
    let liveMarket = mainType ? (prices[mainType].market || 0) : 0;

    document.getElementById('tcgPriceDisplay').textContent = `$${liveMarket.toFixed(2)}`;
    document.getElementById('tcgLowDisplay').textContent = `$${(mainType ? (prices[mainType].low || 0) : 0).toFixed(2)}`;
    document.getElementById('tcgHighDisplay').textContent = `$${(mainType ? (prices[mainType].high || 0) : 0).toFixed(2)}`;

    // Buscar en inventario local por código
    const localCard = allCards.find(c => c.codigo.toLowerCase() === `${card.number}/${card.set.printedTotal}`.toLowerCase());
    const infoDiv = document.getElementById('myCardInfo');
    const emptyDiv = document.getElementById('myCardEmpty');

    if (localCard) {
        infoDiv.style.display = 'block';
        emptyDiv.style.display = 'none';
        document.getElementById('myPriceDisplay').textContent = `$${parseFloat(localCard.precio).toFixed(2)}`;
        document.getElementById('myStockDisplay').textContent = `Stock: ${localCard.stock} unidades`;
        
        // Color según competitividad
        const myPrice = parseFloat(localCard.precio);
        if (myPrice > liveMarket) document.getElementById('myPriceDisplay').style.color = '#ef4444';
        else if (myPrice < liveMarket) document.getElementById('myPriceDisplay').style.color = '#10b981';
        else document.getElementById('myPriceDisplay').style.color = '#3b82f6';
    } else {
        infoDiv.style.display = 'none';
        emptyDiv.style.display = 'block';
    }

    generateTrendChart(liveMarket);
}

function generateTrendChart(currentPrice) {
    const ctx = document.getElementById('priceTrendChart').getContext('2d');
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
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// Buscador para el Modal (Llenado automático)
async function handleQuickSearch() {
    let rawInput = tcgSearchInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();
    
    if (!rawInput) {
        searchStatusMessage.textContent = "Ingresa el código.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }
    
    let cardNumber = rawInput.includes('/') ? rawInput.split('/')[0].trim() : rawInput;
    let totalHint = rawInput.includes('/') ? rawInput.split('/')[1].trim() : null;
    
    searchStatusMessage.textContent = "Buscando...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        let queryStr = `number:"${cardNumber}"`;
        if (setIdInput) queryStr += ` (set.id:"${setIdInput}*" OR set.name:"${setIdInput}*")`;
        
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(queryStr)}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            let card = totalHint ? data.data.find(c => c.set.printedTotal == totalHint) : data.data[0];
            if (!card) card = data.data[0];
            fillCardForm(card);
            clearSearchInputs();
            closeModal(quickSearchModal);
        } else {
            searchStatusMessage.textContent = "No encontrada.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) { 
        searchStatusMessage.textContent = "Error de red."; 
    } finally { 
        submitSearchBtn.disabled = false; 
    }
}

function fillCardForm(card) {
    openModal(cardModal);
    document.getElementById('cardId').value = '';
    document.getElementById('cardName').value = card.name;
    document.getElementById('cardCode').value = `${card.number}/${card.set.printedTotal}`;
    document.getElementById('cardExpansion').value = card.set.name;
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
    document.getElementById('cardCategory').value = 'Pokémon TCG';
}

// ==========================================================================
// 5. CRUD Y CARGA DE DATOS (FIREBASE)
// ==========================================================================

async function handleSaveCard(e) {
    e.preventDefault();
    const id = document.getElementById('cardId').value;
    const nombre = document.getElementById('cardName').value.trim();
    const codigo = document.getElementById('cardCode').value.trim();
    
    // Validación por código (permite nombres repetidos)
    if (allCards.find(c => c.codigo.toLowerCase() === codigo.toLowerCase() && c.id !== id)) { 
        showAlert("Código Duplicado", "Ya tienes registrada una carta con el código: " + codigo); 
        return; 
    }

    const data = { 
        nombre, 
        codigo, 
        expansion: document.getElementById('cardExpansion').value.trim(), 
        imagen_url: document.getElementById('cardImage').value.trim(), 
        precio: parseFloat(document.getElementById('cardPrice').value) || 0, 
        stock: parseInt(document.getElementById('cardStock').value) || 0, 
        categoria: document.getElementById('cardCategory').value 
    };

    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        closeModal(cardModal); 
        await loadAllData();
    } catch (err) { showAlert("Error", "No se pudo guardar la carta."); }
}

async function handleSaveSealed(e) {
    e.preventDefault();
    const id = document.getElementById('sealedProductId').value;
    const nombre = document.getElementById('sealedProductName').value.trim();
    
    if (allSealed.find(p => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== id)) { 
        showAlert("Duplicado", "Este producto ya existe."); 
        return; 
    }
    
    const data = { 
        nombre, 
        categoria: document.getElementById('sealedProductCategory').value, 
        precio: parseFloat(document.getElementById('sealedProductPrice').value) || 0, 
        stock: parseInt(document.getElementById('sealedProductStock').value) || 0, 
        imagen_url: document.getElementById('sealedProductImage').value.trim() 
    };
    
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'), data);
        closeModal(sealedProductModal); 
        await loadAllData();
    } catch (err) { showAlert("Error", "No se pudo guardar el producto."); }
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const nombre = document.getElementById('categoryName').value.trim();
    
    if (allCategories.find(c => c.name.toLowerCase() === nombre.toLowerCase() && c.id !== id)) { 
        showAlert("Categoría Duplicada", "La categoría ya existe."); 
        return; 
    }
    
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id), { name: nombre });
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { name: nombre });
        closeModal(categoryModal); 
        await loadAllData();
    } catch (err) { showAlert("Error", "No se pudo guardar la categoría."); }
}

async function loadAllData() {
    try {
        // Cargar Categorías
        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        
        const catSelects = [document.getElementById('cardCategory'), document.getElementById('sealedProductCategory')];
        catSelects.forEach(sel => { 
            if(sel) { 
                sel.innerHTML = '<option value="" disabled selected>Selecciona</option>'; 
                allCategories.forEach(c => sel.appendChild(new Option(c.name, c.name))); 
            } 
        });

        // Cargar Cartas
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Ejecutar renderizado inicial (considerando si hay una búsqueda activa)
        const searchInput = document.getElementById('inventorySearch');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        if (searchTerm) {
            const filtered = allCards.filter(c => 
                c.nombre.toLowerCase().includes(searchTerm) || 
                c.codigo.toLowerCase().includes(searchTerm)
            );
            renderCardsTable(filtered);
        } else {
            renderCardsTable();
        }

        // Cargar Sellados
        const sealedSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'));
        allSealed = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedTable();

        // Cargar Pedidos
        const orderSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrdersTable();
        
        updateStats();
    } catch (e) { console.error("Error cargando datos:", e); }
}

function renderCardsTable(cardsToRender = allCards) {
    const tbody = document.querySelector('#cardsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    
    if (cardsToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8;">No se encontraron cartas que coincidan.</td></tr>';
        return;
    }

    cardsToRender.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>${c.expansion || '-'}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${c.id}" data-type="card"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="card" style="color: #ef4444;"><i class="fas fa-trash"></i></button>
            </td>`;
    });
}

function renderSealedTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allSealed.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${p.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria}</td>
            <td>$${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${p.id}" data-type="sealed"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${p.id}" data-type="sealed" style="color: #ef4444;"><i class="fas fa-trash"></i></button>
            </td>`;
    });
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${c.id}" data-type="category"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="category" style="color: #ef4444;"><i class="fas fa-trash"></i></button>
            </td>`;
    });
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${o.id.substring(0,8)}</td>
            <td>${o.customerName || 'Invitado'}</td>
            <td>$${parseFloat(o.total || 0).toFixed(2)}</td>
            <td><span class="status-badge ${o.status || 'pendiente'}">${o.status || 'pendiente'}</span></td>
            <td><button class="action-btn view-order" data-id="${o.id}"><i class="fas fa-eye"></i></button></td>`;
    });
}

function updateStats() {
    document.getElementById('totalCardsCount').textContent = allCards.length;
    document.getElementById('totalSealedProductsCount').textContent = allSealed.length;
    document.getElementById('uniqueCategoriesCount').textContent = allCategories.length;
    document.getElementById('outOfStockCount').textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
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
    sealedProductModal = document.getElementById('sealedProductModal');
    sealedProductForm = document.getElementById('sealedProductForm');
    categoryModal = document.getElementById('categoryModal');
    categoryForm = document.getElementById('categoryForm');
    quickSearchModal = document.getElementById('scannerModal');

    // Navegación
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); showSection(link.dataset.section); }));
    document.getElementById('openSidebar')?.addEventListener('click', () => toggleSidebar(true));
    document.getElementById('closeSidebar')?.addEventListener('click', () => toggleSidebar(false));
    sidebarOverlay?.addEventListener('click', () => toggleSidebar(false));
    document.getElementById('btnCompareSearch')?.addEventListener('click', handleMarketComparison);

    // Lógica del buscador de inventario
    document.getElementById('inventorySearch')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allCards.filter(c => 
            c.nombre.toLowerCase().includes(searchTerm) || 
            c.codigo.toLowerCase().includes(searchTerm)
        );
        renderCardsTable(filtered);
    });

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

    // Submits de Formularios
    cardForm?.addEventListener('submit', handleSaveCard);
    sealedProductForm?.addEventListener('submit', handleSaveSealed);
    categoryForm?.addEventListener('submit', handleSaveCategory);

    // Abrir modales de creación
    document.getElementById('addCardBtn')?.addEventListener('click', () => { cardForm.reset(); document.getElementById('cardId').value = ''; refreshPreviewImage(""); openModal(cardModal); });
    document.getElementById('addSealedProductBtn')?.addEventListener('click', () => { sealedProductForm.reset(); document.getElementById('sealedProductId').value = ''; openModal(sealedProductModal); });
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => { categoryForm.reset(); document.getElementById('categoryId').value = ''; openModal(categoryModal); });
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));
    document.getElementById('refreshAdminPageBtn')?.addEventListener('click', () => location.reload());

    // Inyectar Buscador TCG en modal
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <button class="close-button" id="closeScannerX">&times;</button>
            <h2 style="margin-bottom: 20px; font-weight:700;"><i class="fas fa-search"></i> Buscador TCG</h2>
            <div style="margin-bottom: 12px; text-align: left;">
                <label style="font-weight:700; font-size:0.75rem; color:#475569;">Código (ej: 028/151)</label>
                <input type="text" id="tcgSearchInput" placeholder="Número..." style="width: 100%; padding: 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-top: 5px;">
            </div>
            <div style="margin-bottom: 18px; text-align: left;">
                <label style="font-weight:700; font-size:0.75rem; color:#475569;">Expansión (Opcional)</label>
                <input type="text" id="searchSetId" placeholder="Ej: 151" style="width: 100%; padding: 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-top: 5px;">
            </div>
            <button id="submitSearch" style="width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;">Consultar</button>
            <p id="searchStatus" style="margin-top: 15px; font-size: 0.85rem;"></p>
        `;
        tcgSearchInput = document.getElementById('tcgSearchInput'); 
        searchSetIdInput = document.getElementById('searchSetId'); 
        submitSearchBtn = document.getElementById('submitSearch'); 
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
        document.getElementById('closeScannerX')?.addEventListener('click', () => { closeModal(quickSearchModal); clearSearchInputs(); });
    }

    // Eventos de Modales
    document.getElementById('btnAlertAccept')?.addEventListener('click', () => closeModal(alertModal));
    document.getElementById('btnCancelDelete')?.addEventListener('click', () => closeModal(confirmDeleteModal));
    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.admin-modal'))));
    document.getElementById('cardImage')?.addEventListener('input', (e) => refreshPreviewImage(e.target.value));

    // Delegación de clics (Editar / Borrar / Ver Pedido)
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        const id = btn.dataset.id; const type = btn.dataset.type;

        if (btn.classList.contains('edit')) {
            if (type === 'card') {
                const d = allCards.find(x => x.id === id);
                document.getElementById('cardId').value = d.id; document.getElementById('cardName').value = d.nombre; document.getElementById('cardCode').value = d.codigo; document.getElementById('cardExpansion').value = d.expansion || ''; document.getElementById('cardImage').value = d.imagen_url; refreshPreviewImage(d.imagen_url); document.getElementById('cardPrice').value = d.precio; document.getElementById('cardStock').value = d.stock; document.getElementById('cardCategory').value = d.categoria;
                openModal(cardModal);
            } else if (type === 'sealed') {
                const d = allSealed.find(x => x.id === id);
                document.getElementById('sealedProductId').value = d.id; document.getElementById('sealedProductName').value = d.nombre; document.getElementById('sealedProductCategory').value = d.categoria; document.getElementById('sealedProductPrice').value = d.precio; document.getElementById('sealedProductStock').value = d.stock; document.getElementById('sealedProductImage').value = d.imagen_url;
                openModal(sealedProductModal);
            } else if (type === 'category') {
                const d = allCategories.find(x => x.id === id);
                document.getElementById('categoryId').value = d.id; document.getElementById('categoryName').value = d.name;
                openModal(categoryModal);
            }
        }
        if (btn.classList.contains('delete')) { pendingDelete = { id, type }; openModal(confirmDeleteModal); }
        if (btn.classList.contains('view-order')) {
            const order = allOrders.find(o => o.id === btn.dataset.id);
            if(order) { showAlert("Detalles del Pedido", `Cliente: ${order.customerName}\nTotal: $${order.total}\nEstado: ${order.status}`); }
        }
    });

    document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
        if (!pendingDelete.id) return;
        const col = pendingDelete.type === 'card' ? 'cards' : (pendingDelete.type === 'sealed' ? 'sealed_products' : 'categories');
        try { 
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, pendingDelete.id)); 
            closeModal(confirmDeleteModal); 
            await loadAllData(); 
        } catch (err) { showAlert("Error", "No se pudo eliminar."); }
    });

    document.getElementById('nav-logout-btn')?.addEventListener('click', () => signOut(auth).then(() => location.reload()));
    
    // Auth inicial del entorno
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
    };
    initAuth();
});
