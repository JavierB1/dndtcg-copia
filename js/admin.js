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

// --- ELEMENTOS ---
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const btnLogout = document.getElementById('btnLogout');

let allData = { cards: [], products: [], categories: [], orders: [] };

// --- VERIFICACIÓN DE SESIÓN (EL CORAZÓN DEL CÓDIGO) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Acceso concedido a:", user.email);
        // 1. Mostrar el panel ANTES de cargar datos para que se vea la interfaz
        document.body.classList.add('auth-ready');
        // 2. Cargar datos de Firestore de forma segura
        await loadDashboardData();
    } else {
        console.log("No hay sesión activa.");
        document.body.classList.remove('auth-ready');
        // Limpiar tablas para evitar que queden datos viejos al cerrar sesión
        clearAllTables();
    }
});

// --- CARGA DE DATOS ---
async function loadDashboardData() {
    try {
        // Ejecutamos todo en paralelo para máxima velocidad
        const [catSnap, cardSnap, prodSnap, orderSnap] = await Promise.all([
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'))
        ]);

        allData.categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allData.cards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allData.products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allData.orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderAll();
    } catch (err) {
        console.error("Error cargando Firestore:", err);
        // Si hay error de permisos (Missing or insufficient permissions), 
        // probablemente el usuario no está logueado correctamente en Firestore.
    }
}

// --- RENDERIZADO ---
function renderAll() {
    updateStats();
    renderCardsTable();
    renderCategoriesTable();
    renderProductsTable();
    renderOrdersTable();
    populateFilters();
}

function updateStats() {
    document.getElementById('stat-total-cards').textContent = allData.cards.length;
    const totalStock = allData.cards.reduce((acc, c) => acc + (parseInt(c.stock) || 0), 0);
    document.getElementById('stat-total-stock').textContent = totalStock;
    document.getElementById('stat-total-orders').textContent = allData.orders.length;
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.cards.map(c => `
        <tr>
            <td><img src="${c.imagen_url}" width="40" onerror="this.src='https://via.placeholder.com/40'"></td>
            <td>${c.nombre}</td>
            <td>$${parseFloat(c.precio || 0).toFixed(2)}</td>
            <td>${c.stock || 0}</td>
            <td>${c.categoria || 'N/A'}</td>
            <td>
                <button class="btn-icon"><i class="fas fa-edit"></i></button>
                <button class="btn-icon text-red"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderCategoriesTable() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.categories.map(c => `
        <tr>
            <td>${c.id.substring(0,6)}</td>
            <td>${c.name}</td>
            <td><button class="btn-icon text-red"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function renderProductsTable() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.products.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td>$${parseFloat(p.precio || 0).toFixed(2)}</td>
            <td>${p.stock || 0}</td>
            <td><button class="btn-icon"><i class="fas fa-edit"></i></button></td>
        </tr>
    `).join('');
}

function renderOrdersTable() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allData.orders.map(o => `
        <tr>
            <td>#${o.id.substring(0,8)}</td>
            <td>${o.customer?.nombre || 'Anónimo'}</td>
            <td>$${(o.total || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${o.status || 'pending'}">${o.status || 'pendiente'}</span></td>
            <td><button class="btn-icon"><i class="fas fa-eye"></i></button></td>
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

// --- LOGIN ---
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        btn.disabled = true;
        loginMessage.textContent = "Verificando...";
        loginMessage.style.color = "var(--primary)";
        
        await signInWithEmailAndPassword(auth, email, pass);
        // El onAuthStateChanged detectará el éxito y hará el resto
    } catch (err) {
        btn.disabled = false;
        loginMessage.textContent = "Error: Credenciales no válidas.";
        loginMessage.style.color = "var(--red)";
    }
});

// --- LOGOUT ---
btnLogout?.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
});

// --- NAVEGACIÓN ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href')?.substring(1);
        if (targetId && targetId !== '#') {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        }
    });
});
