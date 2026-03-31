// IMPORTACIONES DE FIREBASE
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

// ELEMENTOS DEL DOM
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const btnLogout = document.getElementById('btnLogout');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminCategoryFilter = document.getElementById('adminCategoryFilter');

// ESTADO GLOBAL DE DATOS
let allCards = [];
let allProducts = [];
let allCategories = [];
let allOrders = [];

// CONTROL DE ACCESO Y CARGA INICIAL
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Sesión activa para:", user.email);
        document.body.classList.add('auth-ready');
        loadAllAdminData();
    } else {
        console.log("No hay sesión");
        document.body.classList.remove('auth-ready');
    }
});

// FUNCIÓN MAESTRA DE CARGA
async function loadAllAdminData() {
    try {
        await Promise.all([
            fetchCategories(),
            fetchCards(),
            fetchSealedProducts(),
            fetchOrders()
        ]);
        updateDashboardStats();
    } catch (error) {
        console.error("Error cargando datos administrativos:", error);
    }
}

// OBTENER CATEGORÍAS
async function fetchCategories() {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    const snap = await getDocs(colRef);
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategories();
    populateCategoryFilters();
}

// OBTENER CARTAS
async function fetchCards() {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'cards');
    const snap = await getDocs(colRef);
    allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCards();
}

// OBTENER PRODUCTOS SELLADOS
async function fetchSealedProducts() {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products');
    const snap = await getDocs(colRef);
    allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
}

// OBTENER PEDIDOS
async function fetchOrders() {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const snap = await getDocs(colRef);
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrders();
}

// ACTUALIZAR DASHBOARD
function updateDashboardStats() {
    document.getElementById('stat-total-cards').textContent = allCards.length;
    const totalStock = allCards.reduce((acc, card) => acc + (parseInt(card.stock) || 0), 0);
    document.getElementById('stat-total-stock').textContent = totalStock;
    document.getElementById('stat-total-orders').textContent = allOrders.length;
}

// RENDERIZADO DE TABLAS
function renderCards() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = adminSearchInput?.value.toLowerCase() || "";
    const filterCat = adminCategoryFilter?.value || "";

    const filtered = allCards.filter(c => 
        c.nombre.toLowerCase().includes(searchTerm) && 
        (filterCat === "" || c.categoria === filterCat)
    );

    filtered.forEach(card => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${card.id.substring(0, 6)}</td>
            <td><img src="${card.imagen_url}" style="width:40px; border-radius:4px;"></td>
            <td>${card.nombre}</td>
            <td>$${parseFloat(card.precio).toFixed(2)}</td>
            <td>${card.stock}</td>
            <td>${card.categoria || 'N/A'}</td>
            <td>
                <button class="action-btn-edit" onclick="editCard('${card.id}')"><i class="fas fa-edit"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCategories() {
    const tbody = document.querySelector('#categoriesTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allCategories.map(cat => `
        <tr>
            <td>${cat.id.substring(0,6)}</td>
            <td>${cat.name}</td>
            <td><button class="action-btn-delete"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

function renderProducts() {
    const tbody = document.querySelector('#sealedProductsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allProducts.map(p => `
        <tr>
            <td>${p.id.substring(0,6)}</td>
            <td>${p.nombre}</td>
            <td>$${parseFloat(p.precio).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td><button class="action-btn-edit"><i class="fas fa-edit"></i></button></td>
        </tr>
    `).join('');
}

function renderOrders() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allOrders.map(o => `
        <tr>
            <td>${o.id.substring(0,8)}</td>
            <td>${o.customer?.nombre || 'Cliente'}</td>
            <td>$${(o.total || 0).toFixed(2)}</td>
            <td><span class="badge-${o.status}">${o.status}</span></td>
            <td><button class="action-btn-view"><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
}

function populateCategoryFilters() {
    if (!adminCategoryFilter) return;
    const options = allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>' + options;
}

// EVENTOS DE BÚSQUEDA
adminSearchInput?.addEventListener('input', renderCards);
adminCategoryFilter?.addEventListener('change', renderCards);

// LÓGICA DE LOGIN
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        loginMessage.style.display = "block";
        loginMessage.style.color = "var(--primary)";
        loginMessage.textContent = "Validando acceso...";
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        loginMessage.style.color = "var(--red)";
        loginMessage.textContent = "Credenciales incorrectas.";
    }
});

// LÓGICA DE SALIDA
btnLogout.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.reload();
});

// NAVEGACIÓN
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href')?.substring(1);
        if (targetId && targetId !== '') {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        }
    });
});
