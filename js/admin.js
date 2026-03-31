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
// 2. CONTROL DE SESIÓN (LOGIN OBLIGATORIO)
// ==========================================================================
let isForcedLogoutDone = false;

// Forzar logout inicial para asegurar login manual al recargar la pestaña
const forceLogout = async () => {
    try {
        await signOut(auth);
        isForcedLogoutDone = true;
        console.log("Sesión previa limpiada. Esperando login manual.");
    } catch (e) {
        isForcedLogoutDone = true;
    }
};
forceLogout();

// Variables Globales de Estado
let allCards = [], allCategories = [], allSealed = [], allOrders = [];
let pendingDelete = { id: null, type: null }; 

// Elementos UI
let loginView, adminView, sidebarMenu;
let cardForm, cardModal, sealedProductForm, sealedProductModal, categoryForm, categoryModal, quickSearchModal, confirmDeleteModal;
let searchStatusMessage, tcgSearchInput, searchSetIdInput, submitSearchBtn;
let cardImagePreview, imagePreviewContainer;

// ==========================================================================
// 3. FUNCIONES DE UI Y MODALES
// ==========================================================================

function openModal(m) { 
    if(m){ 
        m.style.display='flex'; 
        document.body.style.overflow='hidden'; 
    } 
}

function closeModal(m) { 
    if(m){ 
        m.style.display='none'; 
        document.body.style.overflow=''; 
    } 
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

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if(activeLink) activeLink.classList.add('active');
    
    const titleEl = document.getElementById('main-title');
    const titles = { 
        'dashboard-section': 'Panel de Control', 
        'cards-section': 'Gestión de Cartas', 
        'sealed-products-section': 'Productos Sellados', 
        'categories-section': 'Categorías', 
        'orders-section': 'Pedidos' 
    };
    if(titleEl) titleEl.textContent = titles[sectionId] || 'Panel';
}

// ==========================================================================
// 4. BÚSQUEDA TCGPLAYER
// ==========================================================================

async function handleQuickSearch() {
    let rawInput = tcgSearchInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();
    if (!rawInput) {
        searchStatusMessage.textContent = "Ingresa el número de carta.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }
    let cardNumber = rawInput.includes('/') ? rawInput.split('/')[0].trim() : rawInput;
    let totalHint = rawInput.includes('/') ? rawInput.split('/')[1].trim() : null;
    
    searchStatusMessage.textContent = "Buscando en API...";
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
        searchStatusMessage.textContent = "Error de conexión con la API."; 
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
// 5. CRUD Y CARGA DE DATOS
// ==========================================================================

async function handleSaveCard(e) {
    e.preventDefault();
    const id = document.getElementById('cardId').value;
    const nombre = document.getElementById('cardName').value.trim();
    if (allCards.find(c => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id !== id)) { 
        alert("¡Error! Ya existe una carta con este nombre."); 
        return; 
    }
    const data = { 
        nombre, 
        codigo: document.getElementById('cardCode').value, 
        expansion: document.getElementById('cardExpansion').value, 
        imagen_url: document.getElementById('cardImage').value, 
        precio: parseFloat(document.getElementById('cardPrice').value) || 0, 
        stock: parseInt(document.getElementById('cardStock').value) || 0, 
        categoria: document.getElementById('cardCategory').value 
    };
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        closeModal(cardModal); 
        await loadAllData();
    } catch (err) { console.error(err); }
}

async function handleSaveSealed(e) {
    e.preventDefault();
    const id = document.getElementById('sealedProductId').value;
    const nombre = document.getElementById('sealedProductName').value.trim();
    if (allSealed.find(p => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== id)) { 
        alert("¡Error! Nombre de producto duplicado."); 
        return; 
    }
    const data = { 
        nombre, 
        categoria: document.getElementById('sealedProductCategory').value, 
        precio: parseFloat(document.getElementById('sealedProductPrice').value) || 0, 
        stock: parseInt(document.getElementById('sealedProductStock').value) || 0, 
        imagen_url: document.getElementById('sealedProductImage').value 
    };
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'), data);
        closeModal(sealedProductModal); 
        await loadAllData();
    } catch (err) { console.error(err); }
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const nombre = document.getElementById('categoryName').value.trim();
    if (allCategories.find(c => c.name.toLowerCase() === nombre.toLowerCase() && c.id !== id)) { 
        alert("¡Error! Esta categoría ya existe."); 
        return; 
    }
    const data = { name: nombre };
    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), data);
        closeModal(categoryModal); 
        await loadAllData();
    } catch (err) { console.error(err); }
}

async function loadAllData() {
    try {
        // Categorías
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
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrdersTable();
        
        updateStats();
    } catch (e) { console.error("Error al cargar datos de Firebase:", e); }
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody'); if(!tbody) return; tbody.innerHTML = '';
    allCards.forEach(c => {
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
            </td>
        `;
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
            </td>
        `;
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
            </td>
        `;
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
            <td><button class="action-btn"><i class="fas fa-eye"></i></button></td>
        `;
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
    sidebarMenu = document.getElementById('sidebar-menu');
    
    cardForm = document.getElementById('cardForm'); 
    cardModal = document.getElementById('cardModal');
    sealedProductForm = document.getElementById('sealedProductForm'); 
    sealedProductModal = document.getElementById('sealedProductModal');
    categoryForm = document.getElementById('categoryForm'); 
    categoryModal = document.getElementById('categoryModal');
    quickSearchModal = document.getElementById('scannerModal'); 
    confirmDeleteModal = document.getElementById('confirmDeleteModal');
    cardImagePreview = document.getElementById('cardImagePreview'); 
    imagePreviewContainer = document.getElementById('imagePreviewContainer');

    // Navegación
    document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { 
        e.preventDefault(); 
        showSection(link.dataset.section); 
    }));

    // Login Form
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const user = document.getElementById('username').value.trim(); 
        const pass = document.getElementById('password').value;
        const msg = document.getElementById('loginMessage'); 
        const btn = document.getElementById('loginBtnSubmit');
        try { 
            btn.disabled = true; 
            btn.textContent = "Verificando..."; 
            await setPersistence(auth, browserSessionPersistence); 
            await signInWithEmailAndPassword(auth, user, pass); 
        } catch (err) { 
            btn.disabled = false; 
            btn.textContent = "Acceder"; 
            if(msg) { msg.textContent = "Credenciales incorrectas."; msg.style.display = "block"; } 
        }
    });

    // Listener de Auth
    onAuthStateChanged(auth, (user) => {
        // CORRECCIÓN CRÍTICA: Solo permitimos acceso si el usuario NO es anónimo 
        // y si el proceso de limpieza (forceLogout) ha concluido.
        if (user && !user.isAnonymous && isForcedLogoutDone) { 
            loginView.style.setProperty('display', 'none', 'important'); 
            adminView.style.setProperty('display', 'flex', 'important'); 
            loadAllData(); 
        } else { 
            // Si no hay usuario o es anónimo (login automático del entorno), mostramos el login manual.
            adminView.style.setProperty('display', 'none', 'important'); 
            loginView.style.setProperty('display', 'flex', 'important'); 
        }
    });

    // Inyectar Buscador en el modal scanner
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button" id="closeScannerX">&times;</span>
            <h2 style="margin-bottom: 20px; font-weight:700;"><i class="fas fa-search"></i> Buscador TCG</h2>
            <div style="margin-bottom: 16px; text-align: left;">
                <label style="font-weight:700; font-size:0.8rem; color:#475569;">Código (028/151)</label>
                <input type="text" id="tcgSearchInput" placeholder="Número..." style="width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <div style="margin-bottom: 24px; text-align: left;">
                <label style="font-weight:700; font-size:0.8rem; color:#475569;">Expansión (Opcional)</label>
                <input type="text" id="searchSetId" placeholder="Ej: 151" style="width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <button id="submitSearch" style="width: 100%; padding: 16px; background: #3182ce; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">Consultar</button>
            <p id="searchStatus" style="margin-top: 20px; font-size: 0.95rem;"></p>
        `;
        tcgSearchInput = document.getElementById('tcgSearchInput'); 
        searchSetIdInput = document.getElementById('searchSetId'); 
        submitSearchBtn = document.getElementById('submitSearch'); 
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
    }

    // Vista previa manual
    document.getElementById('cardImage')?.addEventListener('input', (e) => refreshPreviewImage(e.target.value));

    // Submit de formularios
    cardForm?.addEventListener('submit', handleSaveCard);
    sealedProductForm?.addEventListener('submit', handleSaveSealed);
    categoryForm?.addEventListener('submit', handleSaveCategory);

    // Abrir modales de creación
    document.getElementById('addCardBtn')?.addEventListener('click', () => { cardForm.reset(); document.getElementById('cardId').value = ''; refreshPreviewImage(""); openModal(cardModal); });
    document.getElementById('addSealedProductBtn')?.addEventListener('click', () => { sealedProductForm.reset(); document.getElementById('sealedProductId').value = ''; openModal(sealedProductModal); });
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => { categoryForm.reset(); document.getElementById('categoryId').value = ''; openModal(categoryModal); });
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));
    document.getElementById('refreshAdminPageBtn')?.addEventListener('click', () => location.reload());

    // Modal de Confirmación
    document.getElementById('btnCancelDelete')?.addEventListener('click', () => closeModal(confirmDeleteModal));
    document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
        if (!pendingDelete.id) return;
        const col = pendingDelete.type === 'card' ? 'cards' : (pendingDelete.type === 'sealed' ? 'sealed_products' : 'categories');
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, pendingDelete.id));
            closeModal(confirmDeleteModal);
            await loadAllData();
        } catch (err) { alert("Error al eliminar el documento."); }
    });

    // Delegación de clics en tablas (Editar / Borrar)
    document.body.addEventListener('click', async (e) => {
        if (e.target.classList.contains('close-button')) { 
            const m = e.target.closest('.admin-modal');
            closeModal(m); 
            if(m?.id === 'scannerModal') clearSearchInputs(); 
            return; 
        }
        const btn = e.target.closest('button'); 
        if (!btn) return;
        const id = btn.dataset.id; 
        const type = btn.dataset.type;

        if (btn.classList.contains('edit')) {
            if (type === 'card') {
                const d = allCards.find(x => x.id === id);
                document.getElementById('cardId').value = d.id; 
                document.getElementById('cardName').value = d.nombre; 
                document.getElementById('cardCode').value = d.codigo; 
                document.getElementById('cardExpansion').value = d.expansion || ''; 
                document.getElementById('cardImage').value = d.imagen_url; 
                refreshPreviewImage(d.imagen_url); 
                document.getElementById('cardPrice').value = d.precio; 
                document.getElementById('cardStock').value = d.stock; 
                document.getElementById('cardCategory').value = d.categoria;
                openModal(cardModal);
            } else if (type === 'sealed') {
                const d = allSealed.find(x => x.id === id);
                document.getElementById('sealedProductId').value = d.id; 
                document.getElementById('sealedProductName').value = d.nombre; 
                document.getElementById('sealedProductCategory').value = d.categoria; 
                document.getElementById('sealedProductPrice').value = d.precio; 
                document.getElementById('sealedProductStock').value = d.stock; 
                document.getElementById('sealedProductImage').value = d.imagen_url;
                openModal(sealedProductModal);
            } else if (type === 'category') {
                const d = allCategories.find(x => x.id === id);
                document.getElementById('categoryId').value = d.id; 
                document.getElementById('categoryName').value = d.name;
                openModal(categoryModal);
            }
        }

        if (btn.classList.contains('delete')) {
            pendingDelete = { id, type };
            openModal(confirmDeleteModal);
        }
    });

    // Logout
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => { 
        signOut(auth).then(() => location.reload()); 
    });

    // Autenticación inicial del entorno
    const initAuth = async () => {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            // Se mantiene el inicio anónimo para estabilidad del entorno, 
            // pero el filtro en onAuthStateChanged impedirá el acceso al panel.
            await signInAnonymously(auth);
        }
    };
    initAuth();
});
