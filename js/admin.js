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
// Esta función detecta si el usuario ya está logueado o no
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Sesión activa detectada:", user.email);
        try {
            await loadDashboardData();
            document.body.classList.remove('auth-loading', 'auth-guest');
            document.body.classList.add('auth-ready');
        } catch (err) {
            console.error("Error al cargar datos tras login:", err);
            handleLogout();
        }
    } else {
        console.log("No hay usuario. Mostrando login.");
        document.body.classList.remove('auth-loading', 'auth-ready');
        document.body.classList.add('auth-guest');
        clearAllTables();
    }
});

// --- CARGA DE DATOS ---
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
        console.error("Error cargando Firestore:", err);
        throw err;
    }
}

// --- RENDERIZADO ---
function renderAll() {
    updateStats();
    addSectionActionButtons(); // Nueva función para los botones "Nuevo"
    renderCardsTable();
    renderCategoriesTable();
    renderProductsTable();
    renderOrdersTable();
}

// Agregamos los botones de "Añadir Nuevo" a las cabeceras que no los tengan
function addSectionActionButtons() {
    const sections = [
        { id: 'cards-section', label: 'Nueva Carta', icon: 'fa-plus' },
        { id: 'sealed-products-section', label: 'Nuevo Producto', icon: 'fa-box' },
        { id: 'categories-section', label: 'Nueva Categoría', icon: 'fa-folder-plus' }
    ];

    sections.forEach(sec => {
        const header = document.querySelector(`#${sec.id} .content-header`);
        if (header && !header.querySelector('.btn-add-new')) {
            const btn = document.createElement('button');
            btn.className = 'login-action-btn btn-add-new';
            btn.style.width = 'auto';
            btn.style.padding = '0.5rem 1rem';
            btn.style.fontSize = '0.9rem';
            btn.innerHTML = `<i class="fas ${sec.icon}"></i> ${sec.label}`;
            btn.onclick = () => console.log(`Acción: ${sec.label}`);
            header.appendChild(btn);
        }
    });
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
                <img src="${c.imagen_url || placeholder}" width="40" height="40" style="object-fit: cover; border-radius: 4px;" onerror="this.src='${placeholder}'">
            </td>
            <td>${c.nombre || 'Sin nombre'}</td>
            <td>$${parseFloat(c.precio || 0).toFixed(2)}</td>
            <td>${c.stock || 0}</td>
            <td>${c.categoria || 'N/A'}</td>
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-icon" onclick="console.log('Editar', '${c.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon text-red" onclick="console.log('Eliminar', '${c.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
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
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-icon text-red" onclick="console.log('Borrar Categoría', '${c.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </td>
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
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-icon" onclick="console.log('Editar Producto', '${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon text-red" onclick="console.log('Borrar Producto', '${p.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </td>
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
            <td>
                <div class="action-buttons-cell">
                    <button class="btn-icon" onclick="console.log('Ver pedido', '${o.id}')" title="Ver detalle"><i class="fas fa-eye"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function clearAllTables() {
    document.querySelectorAll('table tbody').forEach(tb => tb.innerHTML = '');
}

// --- ACCIONES DE USUARIO ---

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (err) {
        console.error("Error logout:", err);
    }
}

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        if (btn) btn.disabled = true;
        loginMessage.textContent = "Verificando...";
        
        // REINSTAURADO: Persistencia de sesión (se borra al cerrar/recargar)
        await setPersistence(auth, browserSessionPersistence);
        
        await signInWithEmailAndPassword(auth, email, pass);
        
    } catch (err) {
        if (btn) btn.disabled = false;
        loginMessage.textContent = "Acceso denegado.";
        loginMessage.style.color = "var(--red)";
        console.error("Login Error:", err);
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
