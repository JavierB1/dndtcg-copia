import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserSessionPersistence, signInWithCustomToken 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Configuración de Firebase
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

let allCards = [], allCategories = [], allSealed = [], allOrders = [];
let trendChart = null;
let isForcedLogoutDone = false;
let confirmPromiseResolve = null; // Para manejar la respuesta del modal de confirmación

// ==========================================================================
// AYUDAS DE INTERFAZ (UI HELPERS)
// ==========================================================================
window.openModalUI = (m) => { 
    if(m) { 
        m.style.display = 'flex'; 
        document.body.style.overflow = 'hidden'; 
    } 
};

window.closeModalUI = (m) => { 
    if(m) { 
        m.style.display = 'none'; 
        document.body.style.overflow = ''; 
    } 
};

// NUEVA FUNCIÓN: Modal de Confirmación Estético
window.showConfirmUI = (title, message) => {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmText').textContent = message;
    window.openModalUI(document.getElementById('confirmModal'));
    return new Promise((resolve) => {
        confirmPromiseResolve = resolve;
    });
};

window.confirmResolve = (val) => {
    window.closeModalUI(document.getElementById('confirmModal'));
    if (confirmPromiseResolve) confirmPromiseResolve(val);
};

window.showAlertUI = (title, text) => {
    const t = document.getElementById('alertTitle');
    const m = document.getElementById('alertText');
    if(t) t.textContent = title;
    if(m) m.textContent = text;
    window.openModalUI(document.getElementById('alertModal'));
};

window.refreshPreviewUI = (url) => {
    const img = document.getElementById('cardImagePreview');
    const icon = document.getElementById('placeholderIcon');
    if (img && icon) {
        if (url && url.startsWith('http')) {
            img.src = url; 
            img.style.display = 'block'; 
            icon.style.display = 'none';
        } else {
            img.style.display = 'none'; 
            icon.style.display = 'block';
        }
    }
};

window.openNewCardModal = () => {
    const form = document.getElementById('cardForm');
    if(form) form.reset();
    document.getElementById('cardId').value = '';
    window.refreshPreviewUI('');
    window.openModalUI(document.getElementById('cardModal'));
};

window.openTCGScanner = () => {
    const codeIn = document.getElementById('tcgSearchInput');
    const expIn = document.getElementById('tcgSetInput');
    const status = document.getElementById('searchStatus');
    if(codeIn) codeIn.value = '';
    if(expIn) expIn.value = '';
    if(status) status.textContent = '';
    window.openModalUI(document.getElementById('scannerModal'));
};

window.openNewSealedModal = () => {
    const form = document.getElementById('sealedProductForm');
    if(form) form.reset();
    document.getElementById('sealedProductId').value = '';
    window.openModalUI(document.getElementById('sealedProductModal'));
};

window.openNewCategoryModal = () => {
    const form = document.getElementById('categoryForm');
    if(form) form.reset();
    document.getElementById('categoryId').value = '';
    window.openModalUI(document.getElementById('categoryModal'));
};

window.logoutUI = () => signOut(auth).then(() => location.reload());

// ==========================================================================
// CONTROL DE SESIÓN
// ==========================================================================
const forceLogout = async () => {
    try { 
        await signOut(auth); 
        isForcedLogoutDone = true; 
    } catch (e) { 
        isForcedLogoutDone = true; 
    }
};
forceLogout();

onAuthStateChanged(auth, (user) => {
    const loginModal = document.getElementById('loginModal');
    const adminContainer = document.getElementById('adminContainer');
    if (user && !user.isAnonymous && isForcedLogoutDone) {
        if (loginModal) loginModal.style.display = 'none';
        if (adminContainer) adminContainer.style.display = 'flex';
        loadAllData();
    } else {
        if (adminContainer) adminContainer.style.display = 'none';
        if (loginModal) loginModal.style.display = 'flex';
    }
});

// ==========================================================================
// CARGA DE DATOS
// ==========================================================================
function loadAllData() {
    onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'cards')), (snap) => {
        allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        filterAndRenderCards();
        updateStats();
    });

    onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products')), (snap) => {
        allSealed = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedTable();
        updateStats();
    });

    onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'categories')), (snap) => {
        allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        updateCategorySelects();
        updateStats();
    });

    onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'orders')), (snap) => {
        allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrdersTable();
    });
}

function filterAndRenderCards() {
    const term = document.getElementById('inventorySearch')?.value.toLowerCase();
    const filtered = allCards.filter(c => 
        c.nombre.toLowerCase().includes(term || "") || 
        (c.codigo && c.codigo.toLowerCase().includes(term || ""))
    );
    renderCardsTable(filtered);
}

function renderCardsTable(list) {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    list.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></td>
            <td style="font-weight:700; color: #1e293b;">${c.nombre}</td>
            <td style="color: #64748b;">${c.expansion || '-'}</td>
            <td style="color: #64748b; font-family: monospace;">${c.codigo}</td>
            <td style="font-weight:700; color:#3b82f6;">$${parseFloat(c.precio).toFixed(2)}</td>
            <td><span style="background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-weight: 600;">${c.stock}</span></td>
            <td>
                <button onclick="window.editCard('${c.id}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteCard('${c.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; margin-left:12px;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSealedTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allSealed.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${p.imagen_url}" width="40" style="border-radius:4px;"></td>
            <td>${p.nombre}</td>
            <td>${p.categoria}</td>
            <td>$${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button onclick="window.editSealed('${p.id}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteSealed('${p.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCategories.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.name}</td>
            <td>
                <button onclick="window.editCategory('${c.id}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteCategory('${c.id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allOrders.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${o.id.substring(0,6)}</td>
            <td>${o.customerName || 'Invitado'}</td>
            <td>$${parseFloat(o.total || 0).toFixed(2)}</td>
            <td>${o.status}</td>
            <td><button onclick="window.viewOrder('${o.id}')" style="color:#3b82f6; border:none; background:none; cursor:pointer;"><i class="fas fa-eye"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================================================
// FUNCIONES CRUD
// ==========================================================================
window.editCard = (id) => {
    const card = allCards.find(c => c.id === id);
    if (!card) return;
    document.getElementById('cardId').value = card.id;
    document.getElementById('cardName').value = card.nombre;
    document.getElementById('cardExpansion').value = card.expansion || '';
    document.getElementById('cardCode').value = card.codigo;
    document.getElementById('cardStock').value = card.stock;
    document.getElementById('cardPrice').value = card.precio;
    document.getElementById('cardImage').value = card.imagen_url;
    window.refreshPreviewUI(card.imagen_url);
    window.openModalUI(document.getElementById('cardModal'));
};

window.deleteCard = async (id) => { 
    // MODAL ESTÉTICO EN VEZ DE confirm()
    const confirmed = await window.showConfirmUI("¿Eliminar carta?", "Esta acción eliminará la carta definitivamente de tu inventario y no se podrá deshacer.");
    if (confirmed) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id)); 
    }
};

window.editSealed = (id) => {
    const p = allSealed.find(x => x.id === id);
    if(!p) return;
    document.getElementById('sealedProductId').value = p.id;
    document.getElementById('sealedProductName').value = p.nombre;
    document.getElementById('sealedProductCategory').value = p.categoria;
    document.getElementById('sealedProductPrice').value = p.precio;
    document.getElementById('sealedProductStock').value = p.stock;
    document.getElementById('sealedProductImage').value = p.imagen_url;
    window.openModalUI(document.getElementById('sealedProductModal'));
};

window.deleteSealed = async (id) => { 
    const confirmed = await window.showConfirmUI("¿Eliminar producto?", "¿Deseas borrar este producto sellado? Esta acción es permanente.");
    if(confirmed) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id)); 
    }
};

window.editCategory = (id) => {
    const c = allCategories.find(x => x.id === id);
    if(!c) return;
    document.getElementById('categoryId').value = c.id;
    document.getElementById('categoryName').value = c.name;
    window.openModalUI(document.getElementById('categoryModal'));
};

window.deleteCategory = async (id) => { 
    const confirmed = await window.showConfirmUI("¿Eliminar categoría?", "Al borrar la categoría, los productos asociados no se borrarán pero quedarán sin categoría asignada.");
    if(confirmed) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id)); 
    }
};

window.viewOrder = (id) => { 
    const o = allOrders.find(x => x.id === id); 
    if(o) window.showAlertUI("Detalle del Pedido", `Cliente: ${o.customerName}\nTotal: $${o.total}\nEstado: ${o.status}`); 
};

// ==========================================================================
// LÓGICA DE API TCGPLAYER
// ==========================================================================
window.handleTCGSearchUI = async () => {
    const codeIn = document.getElementById('tcgSearchInput');
    const expIn = document.getElementById('tcgSetInput');
    const status = document.getElementById('searchStatus');
    const btn = document.getElementById('submitSearch');
    if(!codeIn?.value.trim()) return;
    
    btn.disabled = true;
    btn.textContent = "Buscando...";
    status.textContent = "";
    
    let num = codeIn.value.trim().split('/')[0];
    let expansion = expIn?.value.trim();
    
    try {
        let apiUrl = `https://api.pokemontcg.io/v2/cards?q=number:"${num}"`;
        if (expansion) apiUrl += ` set.name:"${expansion}*"`;
        
        const res = await fetch(apiUrl);
        const data = await res.json();
        
        if (data.data && data.data.length > 0) {
            const c = data.data[0];
            document.getElementById('cardId').value = '';
            document.getElementById('cardName').value = c.name;
            document.getElementById('cardExpansion').value = c.set.name;
            document.getElementById('cardCode').value = `${c.number}/${c.set.printedTotal}`;
            document.getElementById('cardImage').value = c.images.large;
            const market = (c.tcgplayer?.prices?.holofoil?.market || c.tcgplayer?.prices?.normal?.market || 0);
            document.getElementById('cardPrice').value = market.toFixed(2);
            document.getElementById('cardStock').value = 1;
            window.refreshPreviewUI(c.images.large);
            window.closeModalUI(document.getElementById('scannerModal'));
            window.openModalUI(document.getElementById('cardModal'));
        } else { 
            status.textContent = "No se encontró ninguna carta."; 
            status.style.color = "#ef4444"; 
        }
    } catch (e) { 
        status.textContent = "Error de conexión."; 
        status.style.color = "#ef4444"; 
    }
    btn.disabled = false;
    btn.textContent = "Consultar";
};

window.handleMarketComparisonUI = async () => {
    const input = document.getElementById('compSearchInput');
    if(!input?.value.trim()) return;
    let num = input.value.trim().split('/')[0];
    try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:"${num}"`);
        const data = await res.json();
        if(data.data && data.data.length > 0) {
            document.getElementById('comparisonResults').style.display = 'block';
            const card = data.data[0];
            const market = (card.tcgplayer?.prices?.holofoil?.market || 10);
            renderChartUI(market);
        }
    } catch (e) { console.error(e); }
};

function renderChartUI(price) {
    const ctx = document.getElementById('priceTrendChart')?.getContext('2d');
    if(!ctx) return;
    if(trendChart) trendChart.destroy();
    trendChart = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Hoy'], 
            datasets: [{ 
                label: 'Mercado ($)', 
                data: [0.98, 1.02, 0.95, 1.05, 1, 1.08, 1].map(f => price * f), 
                borderColor: '#3b82f6', 
                fill: true, 
                tension: 0.4, 
                backgroundColor: 'rgba(59, 130, 246, 0.1)' 
            }] 
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ==========================================================================
// EVENTOS PRINCIPALES
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const qs = document.getElementById('quickSearchContent');
    if (qs) {
        qs.innerHTML = `
            <button class="close-button" onclick="window.closeModalUI(document.getElementById('scannerModal'))">&times;</button>
            <h2 style="margin-bottom:25px; font-weight:800; color: #1e293b;">Buscador TCGPlayer</h2>
            <div class="login-field" style="margin-bottom:12px;">
                <label>Código de la Carta (Prioridad)</label>
                <input type="text" id="tcgSearchInput">
                <i class="fas fa-barcode"></i>
            </div>
            <div class="login-field" style="margin-bottom:20px;">
                <label>Expansión (Opcional)</label>
                <input type="text" id="tcgSetInput">
                <i class="fas fa-layer-group"></i>
            </div>
            <button id="submitSearch" class="confirm-button" style="width:100%;" onclick="window.handleTCGSearchUI()">Consultar</button>
            <p id="searchStatus" style="margin-top:15px; text-align:center; font-size: 0.85rem;"></p>
        `;
    }

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const btn = document.getElementById('loginBtnSubmit');
        btn.disabled = true;
        btn.textContent = "Verificando...";
        try { 
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, email, pass); 
        } catch (err) {
            btn.disabled = false;
            btn.textContent = "Iniciar Sesión";
            const msg = document.getElementById('loginMessage');
            if(msg) { msg.textContent = "Error: Credenciales no válidas."; msg.style.display = 'block'; }
        }
    });

    document.getElementById('cardForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cardId').value;
        const data = { 
            nombre: document.getElementById('cardName').value.trim(), 
            expansion: document.getElementById('cardExpansion').value.trim(), 
            codigo: document.getElementById('cardCode').value.trim(), 
            stock: parseInt(document.getElementById('cardStock').value) || 0, 
            precio: parseFloat(document.getElementById('cardPrice').value) || 0, 
            imagen_url: document.getElementById('cardImage').value.trim() 
        };
        const path = `artifacts/${appId}/public/data/cards`;
        id ? await updateDoc(doc(db, path, id), data) : await addDoc(collection(db, path), data);
        window.closeModalUI(document.getElementById('cardModal'));
    });

    document.getElementById('sealedProductForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('sealedProductId').value;
        const data = { 
            nombre: document.getElementById('sealedProductName').value, 
            categoria: document.getElementById('sealedProductCategory').value, 
            precio: parseFloat(document.getElementById('sealedProductPrice').value), 
            stock: parseInt(document.getElementById('sealedProductStock').value), 
            imagen_url: document.getElementById('sealedProductImage').value 
        };
        const path = `artifacts/${appId}/public/data/sealed_products`;
        id ? await updateDoc(doc(db, path, id), data) : await addDoc(collection(db, path), data);
        window.closeModalUI(document.getElementById('sealedProductModal'));
    });

    document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('categoryId').value;
        const data = { name: document.getElementById('categoryName').value };
        const path = `artifacts/${appId}/public/data/categories`;
        id ? await updateDoc(doc(db, path, id), data) : await addDoc(collection(db, path), data);
        window.closeModalUI(document.getElementById('categoryModal'));
    });

    document.getElementById('inventorySearch')?.addEventListener('input', filterAndRenderCards);
    document.getElementById('cardImage')?.addEventListener('input', (e) => window.refreshPreviewUI(e.target.value));

    document.querySelectorAll('.nav-link').forEach(l => {
        l.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
            l.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            const section = document.getElementById(l.dataset.section);
            if (section) section.classList.add('active');
            const mainTitle = document.getElementById('main-title');
            if (mainTitle) mainTitle.textContent = l.textContent.trim();
        });
    });
});

function updateStats() {
    const elCards = document.getElementById('totalCardsCount');
    const elSealed = document.getElementById('sealedCount');
    const elCats = document.getElementById('uniqueCategoriesCount');
    const elStock = document.getElementById('outOfStockCount');
    if (elCards) elCards.textContent = allCards.length;
    if (elSealed) elSealed.textContent = allSealed.length;
    if (elCats) elCats.textContent = allCategories.length;
    if (elStock) elStock.textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

function updateCategorySelects() {
    const sel = document.getElementById('sealedProductCategory');
    if(sel) {
        sel.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
        allCategories.forEach(c => sel.appendChild(new Option(c.name, c.name)));
    }
}

const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    }
};
initAuth();
