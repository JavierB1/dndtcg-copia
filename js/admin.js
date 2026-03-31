import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    getDocs,
    addDoc,
    serverTimestamp 
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
const auth = getAuth(app);
const db = getFirestore(app);
const appId = firebaseConfig.projectId;

// Referencias a los elementos del DOM
const elements = {
    loginModal: document.getElementById('loginModal'),
    adminPanelContainer: document.getElementById('adminPanelContainer'),
    loginForm: document.getElementById('loginForm'),
    btnLogout: document.getElementById('btnLogout'),
    loginMessage: document.getElementById('loginMessage'),
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.admin-section'),
    // Botones de Agregar
    btnAddCard: document.getElementById('btnAddCard'),
    btnAddSealed: document.getElementById('btnAddSealed'),
    btnAddCategory: document.getElementById('btnAddCategory'),
    // Estadísticas
    statCards: document.getElementById('stat-total-cards'),
    statOrders: document.getElementById('stat-total-orders'),
    statStock: document.getElementById('stat-total-stock'),
    // Tablas
    cardsTableBody: document.querySelector('#cardsTable tbody'),
    sealedTableBody: document.querySelector('#sealedProductsTable tbody'),
    categoriesTableBody: document.querySelector('#categoriesTable tbody'),
    ordersTableBody: document.querySelector('#ordersTable tbody')
};

// --- GESTIÓN DE SESIÓN ---

document.body.className = 'auth-loading';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.body.classList.remove('auth-guest', 'auth-loading');
        document.body.classList.add('auth-ready');
        await loadData();
    } else {
        document.body.classList.remove('auth-ready', 'auth-loading');
        document.body.classList.add('auth-guest');
    }
});

// Login Logic
if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const btn = document.getElementById('btnLoginSubmit');

        try {
            if (btn) { btn.disabled = true; btn.innerText = "Validando..."; }
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            if (elements.loginMessage) {
                elements.loginMessage.textContent = "Acceso denegado. Revisa tus datos.";
            }
            if (btn) { btn.disabled = false; btn.innerText = "Iniciar Sesión"; }
        }
    });
}

// Logout Logic
if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.reload();
    });
}

// --- CARGA DE DATOS ---

async function loadData() {
    const getC = (n) => collection(db, 'artifacts', appId, 'public', 'data', n);
    
    try {
        const [cSnap, sSnap, oSnap, catSnap] = await Promise.all([
            getDocs(getC('cards')),
            getDocs(getC('sealed_products')),
            getDocs(getC('orders')),
            getDocs(getC('categories'))
        ]);

        const cards = cSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const sealed = sSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const orders = oSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const categories = catSnap.docs.map(d => ({id: d.id, ...d.data()}));

        if (elements.statCards) elements.statCards.textContent = cards.length;
        if (elements.statOrders) elements.statOrders.textContent = orders.length;
        if (elements.statStock) {
            const totalStock = cards.reduce((acc, c) => acc + (Number(c.stock) || 0), 0);
            elements.statStock.textContent = totalStock;
        }

        renderAllTables(cards, sealed, orders, categories);
    } catch (err) {
        console.error("Error cargando datos:", err);
    }
}

function renderAllTables(cards, sealed, orders, categories) {
    if (elements.cardsTableBody) {
        elements.cardsTableBody.innerHTML = cards.map(c => `
            <tr>
                <td><img src="${c.imagen_url || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"></td>
                <td>${c.nombre || 'N/A'}</td>
                <td>$${Number(c.precio || 0).toFixed(2)}</td>
                <td>${c.stock || 0}</td>
                <td>
                    <button class="row-action-btn"><i class="fas fa-edit"></i></button>
                    <button class="row-action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    if (elements.sealedTableBody) {
        elements.sealedTableBody.innerHTML = sealed.map(p => `
            <tr>
                <td>${p.nombre || 'N/A'}</td>
                <td>$${Number(p.precio || 0).toFixed(2)}</td>
                <td>${p.stock || 0}</td>
                <td>
                    <button class="row-action-btn"><i class="fas fa-edit"></i></button>
                    <button class="row-action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    if (elements.categoriesTableBody) {
        elements.categoriesTableBody.innerHTML = categories.map(cat => `
            <tr>
                <td style="font-family:monospace; color:#6366f1;">${cat.id}</td>
                <td>${cat.nombre || 'Sin nombre'}</td>
                <td><button class="row-action-btn delete"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    }

    if (elements.ordersTableBody) {
        elements.ordersTableBody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.id.substring(0,6)}</td>
                <td>${o.cliente_nombre || 'Anon'}</td>
                <td>$${Number(o.total || 0).toFixed(2)}</td>
                <td><span class="status-tag">${o.estado || 'Pendiente'}</span></td>
                <td><button class="row-action-btn"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('');
    }
}

// --- LÓGICA DE AGREGAR (MODALES DINÁMICOS) ---

const showAddModal = (type) => {
    let title = "";
    let fields = [];
    let collectionName = "";

    switch(type) {
        case 'card':
            title = "Nueva Carta";
            collectionName = "cards";
            fields = [
                { id: 'nombre', label: 'Nombre de la Carta', type: 'text' },
                { id: 'precio', label: 'Precio ($)', type: 'number' },
                { id: 'stock', label: 'Cantidad en Stock', type: 'number' },
                { id: 'imagen_url', label: 'URL de la Imagen', type: 'text' }
            ];
            break;
        case 'sealed':
            title = "Nuevo Producto Sellado";
            collectionName = "sealed_products";
            fields = [
                { id: 'nombre', label: 'Nombre del Producto', type: 'text' },
                { id: 'precio', label: 'Precio ($)', type: 'number' },
                { id: 'stock', label: 'Cantidad en Stock', type: 'number' }
            ];
            break;
        case 'category':
            title = "Nueva Categoría";
            collectionName = "categories";
            fields = [
                { id: 'nombre', label: 'Nombre de la Categoría', type: 'text' }
            ];
            break;
    }

    // Crear el HTML del modal al vuelo
    const modalOverlay = document.createElement('div');
    modalOverlay.style = "position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;";
    
    const modalContent = document.createElement('div');
    modalContent.className = "login-content"; // Reutilizamos estilos del login
    modalContent.style = "background:#1e293b; padding:2rem; border-radius:1rem; border:1px solid rgba(255,255,255,0.1); width:100%; max-width:450px;";
    
    let fieldsHtml = fields.map(f => `
        <div class="form-input-wrapper">
            <label>${f.label.toUpperCase()}</label>
            <input type="${f.type}" id="modal-${f.id}" step="0.01" required>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:1.5rem; color:white;">${title}</h2>
        <form id="dynamicAddForm">
            ${fieldsHtml}
            <div style="display:flex; gap:10px; margin-top:2rem;">
                <button type="button" id="btnCancelModal" style="flex:1; background:#334155; color:white; padding:10px; border-radius:0.5rem;">Cancelar</button>
                <button type="submit" style="flex:1; background:#6366f1; color:white; padding:10px; border-radius:0.5rem; font-weight:700;">Guardar</button>
            </div>
        </form>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Eventos del Modal
    document.getElementById('btnCancelModal').onclick = () => modalOverlay.remove();
    
    document.getElementById('dynamicAddForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = { createdAt: serverTimestamp() };
        fields.forEach(f => {
            const val = document.getElementById(`modal-${f.id}`).value;
            data[f.id] = f.type === 'number' ? Number(val) : val;
        });

        try {
            const docRef = collection(db, 'artifacts', appId, 'public', 'data', collectionName);
            await addDoc(docRef, data);
            modalOverlay.remove();
            await loadData(); // Recargar tablas
        } catch (err) {
            console.error("Error guardando:", err);
            alert("No se pudo guardar el registro.");
        }
    };
};

// Asignar clics a los botones "+"
if (elements.btnAddCard) elements.btnAddCard.onclick = () => showAddModal('card');
if (elements.btnAddSealed) elements.btnAddSealed.onclick = () => showAddModal('sealed');
if (elements.btnAddCategory) elements.btnAddCategory.onclick = () => showAddModal('category');

// --- NAVEGACIÓN ---

elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        const targetId = href.replace('#', '');

        elements.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        elements.sections.forEach(s => {
            s.classList.remove('active');
            if (s.id === targetId) s.classList.add('active');
        });
    });
});
