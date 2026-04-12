// ==========================================================================
// 1. CONFIGURACIÓN Y SERVICIOS DE FIREBASE (11.6.1)
// ==========================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    signInWithCustomToken, signInAnonymously 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

// ==========================================================================
// 2. VARIABLES DE ESTADO
// ==========================================================================
let allCards = [], allCategories = [], allSealed = [], allOrders = [];
let trendChart = null;
let isForcedLogoutDone = false;

// UI References
const loginModal = document.getElementById('loginModal');
const adminView = document.getElementById('adminContainer');

// ==========================================================================
// 3. VINCULACIÓN GLOBAL (IMPORTANTÍSIMO PARA BOTONES)
// ==========================================================================
window.openModalUI = (m) => { if(m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; } };
window.closeModalUI = (m) => { if(m) { m.style.display = 'none'; document.body.style.overflow = ''; } };

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
    document.getElementById('cardForm').reset();
    document.getElementById('cardId').value = '';
    window.refreshPreviewUI('');
    window.openModalUI(document.getElementById('cardModal'));
};

window.openNewSealedModal = () => {
    document.getElementById('sealedProductForm').reset();
    document.getElementById('sealedProductId').value = '';
    window.openModalUI(document.getElementById('sealedProductModal'));
};

window.openNewCategoryModal = () => {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    window.openModalUI(document.getElementById('categoryModal'));
};

window.logoutUI = () => signOut(auth).then(() => location.reload());

// ==========================================================================
// 4. CONTROL DE SESIÓN
// ==========================================================================
const forceLogout = async () => {
    try { await signOut(auth); isForcedLogoutDone = true; } catch (e) { isForcedLogoutDone = true; }
};
forceLogout();

onAuthStateChanged(auth, (user) => {
    if (user && !user.isAnonymous && isForcedLogoutDone) {
        if(loginModal) loginModal.style.display = 'none';
        if(adminView) adminView.style.display = 'flex';
        loadAllData();
    } else {
        if(adminView) adminView.style.display = 'none';
        if(loginView) loginView.style.display = 'flex';
    }
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtnSubmit');
    const msg = document.getElementById('loginMessage');
    const email = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    btn.disabled = true;
    btn.textContent = "Verificando...";
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (err) {
        btn.disabled = false;
        btn.textContent = "Iniciar Sesión";
        if(msg) { msg.textContent = "Error: Credenciales no válidas."; msg.style.display = 'block'; }
    }
});

// ==========================================================================
// 5. CARGA DE DATOS REALTIME
// ==========================================================================
function loadAllData() {
    const cardsCol = collection(db, 'artifacts', appId, 'public', 'data', 'cards');
    onSnapshot(query(cardsCol), (snap) => {
        allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        filterAndRenderCards();
        updateStats();
    });

    const sealedCol = collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products');
    onSnapshot(query(sealedCol), (snap) => {
        allSealed = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSealedTable();
        updateStats();
    });

    const catCol = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    onSnapshot(query(catCol), (snap) => {
        allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategoriesTable();
        updateCategorySelects();
    });

    const ordersCol = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    onSnapshot(query(ordersCol), (snap) => {
        allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderOrdersTable();
    });
}

// ==========================================================================
// 6. RENDERIZADO DE TABLAS
// ==========================================================================
function filterAndRenderCards() {
    const term = document.getElementById('inventorySearch')?.value.toLowerCase();
    const filtered = allCards.filter(c => 
        c.nombre.toLowerCase().includes(term || "") || 
        c.codigo.toLowerCase().includes(term || "")
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
            <td><img src="${c.imagen_url}" width="40" style="border-radius:8px;"></td>
            <td style="font-weight:700;">${c.nombre}</td>
            <td>${c.codigo}</td>
            <td style="font-weight:700; color:#3b82f6;">$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td>
                <button onclick="window.editCard('${c.id}')" style="color:#3b82f6; background:none; border:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteCard('${c.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; margin-left:12px;"><i class="fas fa-trash"></i></button>
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
                <button onclick="window.editSealed('${p.id}')" style="color:#3b82f6; background:none; border:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteSealed('${p.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
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
                <button onclick="window.editCategory('${c.id}')" style="color:#3b82f6; background:none; border:none; cursor:pointer;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteCategory('${c.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; margin-left:10px;"><i class="fas fa-trash"></i></button>
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
            <td><button onclick="window.viewOrder('${o.id}')" style="color:#3b82f6; background:none; border:none; cursor:pointer;"><i class="fas fa-eye"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================================================
// 7. CRUD WINDOW FUNCTIONS
// ==========================================================================
window.editCard = (id) => {
    const card = allCards.find(c => c.id === id);
    if (!card) return;
    document.getElementById('cardId').value = card.id;
    document.getElementById('cardName').value = card.nombre;
    document.getElementById('cardCode').value = card.codigo;
    document.getElementById('cardStock').value = card.stock;
    document.getElementById('cardPrice').value = card.precio;
    document.getElementById('cardImage').value = card.imagen_url;
    window.refreshPreviewUI(card.imagen_url);
    window.openModalUI(document.getElementById('cardModal'));
};

window.deleteCard = async (id) => {
    if (confirm("¿Eliminar carta?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id));
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
    if(confirm("¿Eliminar producto?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id));
};

window.editCategory = (id) => {
    const c = allCategories.find(x => x.id === id);
    if(!c) return;
    document.getElementById('categoryId').value = c.id;
    document.getElementById('categoryName').value = c.name;
    window.openModalUI(document.getElementById('categoryModal'));
};

window.deleteCategory = async (id) => {
    if(confirm("¿Eliminar categoría?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id));
};

window.viewOrder = (id) => {
    const o = allOrders.find(x => x.id === id);
    if(o) window.showAlertUI("Detalle Pedido", `Cliente: ${o.customerName}\nTotal: $${o.total}\nEstado: ${o.status}`);
};

// ==========================================================================
// 8. TCG PLAYER API & COMPARISON
// ==========================================================================
window.handleTCGSearchUI = async () => {
    const input = document.getElementById('tcgSearchInput');
    const status = document.getElementById('searchStatus');
    const btn = document.getElementById('submitSearch');
    if(!input?.value.trim()) return;
    btn.disabled = true;
    status.textContent = "Buscando...";
    status.style.color = "#3b82f6";
    let num = input.value.trim().split('/')[0];
    try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:"${num}"`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            const c = data.data[0];
            document.getElementById('cardId').value = '';
            document.getElementById('cardName').value = c.name;
            document.getElementById('cardCode').value = `${c.number}/${c.set.printedTotal}`;
            document.getElementById('cardImage').value = c.images.large;
            const p = c.tcgplayer?.prices;
            const market = (p?.holofoil?.market || p?.normal?.market || 0);
            document.getElementById('cardPrice').value = market.toFixed(2);
            document.getElementById('cardStock').value = 1;
            window.refreshPreviewUI(c.images.large);
            window.closeModalUI(document.getElementById('scannerModal'));
            window.openModalUI(document.getElementById('cardModal'));
        } else { status.textContent = "No encontrada."; status.style.color = "#ef4444"; }
    } catch (e) { status.textContent = "Error de red."; }
    btn.disabled = false;
};

window.handleMarketComparisonUI = async () => {
    const input = document.getElementById('compSearchInput');
    const status = document.getElementById('compStatus');
    if(!input?.value.trim()) return;
    status.textContent = "Analizando...";
    let num = input.value.trim().split('/')[0];
    try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:"${num}"`);
        const data = await res.json();
        if(data.data && data.data.length > 0) {
            document.getElementById('comparisonResults').style.display = 'block';
            const card = data.data[0];
            const market = (card.tcgplayer?.prices?.holofoil?.market || 10);
            renderChartUI(market);
            status.textContent = "Completado.";
        }
    } catch (e) { status.textContent = "Error."; }
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
                borderColor: '#3b82f6', fill: true, tension: 0.4, backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }]
        }
    });
}

// ==========================================================================
// 9. EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const qs = document.getElementById('quickSearchContent');
    if (qs) {
        qs.innerHTML = `
            <button class="close-button" onclick="window.closeModalUI(document.getElementById('scannerModal'))">&times;</button>
            <h2 style="margin-bottom:20px; font-weight:800;">Buscador TCGPlayer</h2>
            <div class="login-field"><label>Código Carta</label><input type="text" id="tcgSearchInput" placeholder="Ej: 028/151"></div>
            <button id="submitSearch" class="confirm-button" style="width:100%;" onclick="window.handleTCGSearchUI()">Consultar</button>
            <p id="searchStatus" style="margin-top:15px; text-align:center;"></p>
        `;
    }

    document.getElementById('cardForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cardId').value;
        const data = {
            nombre: document.getElementById('cardName').value.trim(),
            codigo: document.getElementById('cardCode').value.trim(),
            stock: parseInt(document.getElementById('cardStock').value) || 0,
            precio: parseFloat(document.getElementById('cardPrice').value) || 0,
            imagen_url: document.getElementById('cardImage').value.trim()
        };
        const ref = id ? doc(db, 'artifacts', appId, 'public', 'data', 'cards', id) : collection(db, 'artifacts', appId, 'public', 'data', 'cards');
        id ? await updateDoc(ref, data) : await addDoc(ref, data);
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
        const ref = id ? doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id) : collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products');
        id ? await updateDoc(ref, data) : await addDoc(ref, data);
        window.closeModalUI(document.getElementById('sealedProductModal'));
    });

    document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('categoryId').value;
        const data = { name: document.getElementById('categoryName').value };
        const ref = id ? doc(db, 'artifacts', appId, 'public', 'data', 'categories', id) : collection(db, 'artifacts', appId, 'public', 'data', 'categories');
        id ? await updateDoc(ref, data) : await addDoc(ref, data);
        window.closeModalUI(document.getElementById('categoryModal'));
    });

    document.getElementById('inventorySearch')?.addEventListener('input', filterAndRenderCards);
    document.getElementById('cardImage')?.addEventListener('input', (e) => window.refreshPreviewUI(e.target.value));

    document.querySelectorAll('.nav-link').forEach(l => {
        l.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
            l.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(l.dataset.section).classList.add('active');
            document.getElementById('main-title').textContent = l.textContent.trim();
        }
    });
});

function updateStats() {
    document.getElementById('totalCardsCount').textContent = allCards.length;
    document.getElementById('sealedCount').textContent = allSealed.length;
    document.getElementById('uniqueCategoriesCount').textContent = allCategories.length;
    document.getElementById('outOfStockCount').textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

function updateCategorySelects() {
    const sel = document.getElementById('sealedProductCategory');
    if(sel) {
        sel.innerHTML = '<option value="" disabled selected>Selecciona</option>';
        allCategories.forEach(c => sel.appendChild(new Option(c.name, c.name)));
    }
}
