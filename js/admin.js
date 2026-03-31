import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    setPersistence,
    browserSessionPersistence 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
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

let allData = { cards: [], products: [], categories: [], orders: [] };

// --- GESTIÓN DE ESTADO DE AUTENTICACIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Sesion activa detectada:", user.email);
        try {
            await loadDashboardData();
            // Mostramos el panel y ocultamos el login
            document.body.classList.remove('auth-loading', 'auth-guest');
            document.body.classList.add('auth-ready');
        } catch (err) {
            console.error("Error critico de acceso:", err);
            handleLogout();
        }
    } else {
        console.log("No hay usuario autenticado.");
        // Ocultamos el panel y mostramos el login
        document.body.classList.remove('auth-loading', 'auth-ready');
        document.body.classList.add('auth-guest');
        clearAllTables();
    }
});

// --- CARGA DE DATOS DESDE FIRESTORE ---
async function loadDashboardData() {
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

    const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E`;

    tbody.innerHTML = allData.cards.map(c => `
        <tr>
            <td>
                <div class="img-wrapper" style="width: 40px; height: 40px; overflow: hidden; border-radius: 4px; background: #334155;">
                    <img src="${c.imagen_url || placeholder}" 
                         width="40" 
                         style="object-fit: cover; display: block;"
                         onerror="this.onerror=null;this.src='${placeholder}';">
                </div>
            </td>
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
            <td>${o.customer?.nombre || 'Anonimo'}</td>
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
    select.innerHTML = '<option value="">Todas las categorias</option>' + options;
}

// --- ACCIONES DE USUARIO ---

async function handleLogout() {
    try {
        await signOut(auth);
        // Al cerrar sesion forzamos la limpieza visual y recarga
        document.body.className = 'auth-guest';
        window.location.reload();
    } catch (err) {
        console.error("Error al cerrar sesion:", err);
    }
}

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        if (btn) btn.disabled = true;
        loginMessage.textContent = "Iniciando sesion...";
        loginMessage.style.color = "var(--primary)";
        
        // Configuramos persistencia de sesion (se borra al cerrar/recargar)
        await setPersistence(auth, browserSessionPersistence);
        
        // Iniciar sesion
        await signInWithEmailAndPassword(auth, email, pass);
        
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
