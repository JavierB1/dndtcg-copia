import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = firebaseConfig.projectId;

// --- ELEMENTOS DEL DOM ---
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const btnLogout = document.getElementById('btnLogout');
const adminPanelContainer = document.getElementById('adminPanelContainer');

let allData = { cards: [], products: [], categories: [], orders: [] };

// --- GESTIÓN DE ESTADO DE AUTENTICACIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Sesión activa detectada:", user.email);
        try {
            // Intentamos cargar los datos. Si falla por permisos, cerramos sesión.
            await loadDashboardData();
            document.body.classList.add('auth-ready');
        } catch (err) {
            console.error("Error crítico de acceso:", err);
            // Si hay error de permisos al inicio, forzamos el logout para limpiar el estado
            handleLogout();
        }
    } else {
        console.log("No hay usuario autenticado.");
        document.body.classList.remove('auth-ready');
        clearAllTables();
    }
});

// --- CARGA DE DATOS DESDE FIRESTORE ---
async function loadDashboardData() {
    // Definimos las rutas siguiendo la estructura obligatoria de la documentación
    const publicPath = (coll) => collection(db, 'artifacts', appId, 'public', 'data', coll);

    try {
        const [catSnap, cardSnap, prodSnap, orderSnap] = await Promise.all([
            getDocs(publicPath('categories')),
            getDocs(publicPath('cards')),
            getDocs(publicPath('sealed_products')),
            getDocs(publicPath('orders'))
        ]);

        allData.categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allData.cards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allData.products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allData.orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderAll();
    } catch (err) {
        // Propagamos el error para que onAuthStateChanged lo maneje
        throw err;
    }
}

// --- RENDERIZADO DE INTERFAZ ---
function renderAll() {
    updateStats();
    renderCardsTable();
    renderCategoriesTable();
    renderProductsTable();
    renderOrdersTable();
    populateFilters();
}

function updateStats() {
    const cardEl = document.getElementById('stat-total-cards');
    const stockEl = document.getElementById('stat-total-stock');
    const orderEl = document.getElementById('stat-total-orders');

    if (cardEl) cardEl.textContent = allData.cards.length;
    if (stockEl) {
        const totalStock = allData.cards.reduce((acc, c) => acc + (parseInt(c.stock) || 0), 0);
        stockEl.textContent = totalStock;
    }
    if (orderEl) orderEl.textContent = allData.orders.length;
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.cards.map(c => `
        <tr>
            <td><img src="${c.imagen_url || ''}" width="40" alt="${c.nombre}" onerror="this.src='https://via.placeholder.com/40'"></td>
            <td>${c.nombre || 'Sin nombre'}</td>
            <td>$${parseFloat(c.precio || 0).toFixed(2)}</td>
            <td>${c.stock || 0}</td>
            <td>${c.categoria || 'N/A'}</td>
            <td>
                <button class="btn-icon" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-icon text-red" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.categories.map(c => `
        <tr>
            <td>${c.id.substring(0, 6)}</td>
            <td>${c.name || 'Sin nombre'}</td>
            <td><button class="btn-icon text-red" title="Eliminar"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function renderProductsTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.products.map(p => `
        <tr>
            <td>${p.nombre || 'Sin nombre'}</td>
            <td>$${parseFloat(p.precio || 0).toFixed(2)}</td>
            <td>${p.stock || 0}</td>
            <td><button class="btn-icon" title="Editar"><i class="fas fa-edit"></i></button></td>
        </tr>
    `).join('');
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.orders.map(o => `
        <tr>
            <td>#${o.id.substring(0, 8)}</td>
            <td>${o.customer?.nombre || 'Anónimo'}</td>
            <td>$${(o.total || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${o.status || 'pending'}">${o.status || 'pendiente'}</span></td>
            <td><button class="btn-icon" title="Ver detalle"><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
}

function clearAllTables() {
    document.querySelectorAll('table tbody').forEach(tb => tb.innerHTML = '');
}

function populateFilters() {
    const select = document.getElementById('adminCategoryFilter');
    if (!select) return;
    const options = allData.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    select.innerHTML = '<option value="">Todas las categorías</option>' + options;
}

// --- ACCIONES DE USUARIO ---

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (err) {
        console.error("Error al cerrar sesión:", err);
    }
}

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        if (btn) btn.disabled = true;
        loginMessage.textContent = "Verificando credenciales...";
        loginMessage.style.color = "var(--primary)";
        
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged se encargará del resto
    } catch (err) {
        if (btn) btn.disabled = false;
        loginMessage.textContent = "Error: Usuario o contraseña incorrectos.";
        loginMessage.style.color = "var(--red)";
        console.error("Error de login:", err);
    }
});

btnLogout?.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
});

// --- NAVEGACIÓN ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href')?.substring(1);
        if (targetId && targetId !== '#' && targetId !== '') {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');
        }
    });
});
