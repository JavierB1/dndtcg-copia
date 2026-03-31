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

// Estado inicial: Cargando
document.body.className = 'auth-loading';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Sesión iniciada:", user.email);
        document.body.classList.replace('auth-loading', 'auth-ready');
        // Aseguramos visibilidad manual por si el CSS falla
        if (elements.loginModal) elements.loginModal.style.display = 'none';
        if (elements.adminPanelContainer) elements.adminPanelContainer.style.display = 'flex';
        await loadData();
    } else {
        console.log("No hay sesión activa");
        document.body.classList.remove('auth-loading', 'auth-ready');
        document.body.classList.add('auth-guest');
        if (elements.loginModal) elements.loginModal.style.display = 'flex';
        if (elements.adminPanelContainer) elements.adminPanelContainer.style.display = 'none';
    }
});

// Lógica de Login
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
            console.error("Error en login:", err);
            if (elements.loginMessage) {
                elements.loginMessage.textContent = "Credenciales incorrectas.";
            }
            if (btn) { btn.disabled = false; btn.innerText = "Entrar al Panel"; }
        }
    });
}

// Lógica de Logout
if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.reload();
        } catch (err) {
            console.error("Error al cerrar sesión", err);
        }
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

        // Actualizar Estadísticas con comprobación de existencia (Evita el error TypeError)
        if (elements.statCards) elements.statCards.textContent = cards.length;
        if (elements.statOrders) elements.statOrders.textContent = orders.length;
        if (elements.statStock) {
            const totalStock = cards.reduce((acc, c) => acc + (Number(c.stock) || 0), 0) + 
                               sealed.reduce((acc, s) => acc + (Number(s.stock) || 0), 0);
            elements.statStock.textContent = totalStock;
        }

        renderAllTables(cards, sealed, orders, categories);
    } catch (err) {
        console.error("Error cargando datos de Firestore:", err);
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
                <td>${c.categoria || 'Sin categoría'}</td>
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
                <td style="font-family:monospace; color:#6366f1;">${cat.id.substring(0,8)}...</td>
                <td>${cat.nombre || 'Sin nombre'}</td>
                <td><button class="row-action-btn delete"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    }

    if (elements.ordersTableBody) {
        elements.ordersTableBody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.id.substring(0,6)}</td>
                <td>${o.cliente_nombre || 'Anónimo'}</td>
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
                { id: 'categoria', label: 'Categoría', type: 'text' },
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

    const modalOverlay = document.createElement('div');
    modalOverlay.style = "position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:10000; padding:20px; backdrop-filter: blur(4px);";
    
    const modalContent = document.createElement('div');
    modalContent.style = "background:#1e293b; padding:2.5rem; border-radius:1rem; border:1px solid rgba(255,255,255,0.1); width:100%; max-width:450px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);";
    
    let fieldsHtml = fields.map(f => `
        <div style="margin-bottom: 1.2rem;">
            <label style="display:block; color:#94a3b8; font-size:0.75rem; font-weight:700; margin-bottom:0.5rem; letter-spacing:0.05em;">${f.label.toUpperCase()}</label>
            <input type="${f.type}" id="modal-${f.id}" step="0.01" style="width:100%; background:#0f172a; border:1px solid #334155; color:white; padding:0.8rem; border-radius:0.5rem; outline:none;" required>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:1.8rem; color:white; display:flex; align-items:center; gap:10px;">
            <i class="fas fa-plus-circle" style="color:#6366f1;"></i> ${title}
        </h2>
        <form id="dynamicAddForm">
            ${fieldsHtml}
            <div style="display:flex; gap:12px; margin-top:2.5rem;">
                <button type="button" id="btnCancelModal" style="flex:1; background:#334155; color:white; padding:0.8rem; border-radius:0.5rem; font-weight:600; cursor:pointer;">Cancelar</button>
                <button type="submit" style="flex:1; background:#6366f1; color:white; padding:0.8rem; border-radius:0.5rem; font-weight:700; cursor:pointer;">Guardar Registro</button>
            </div>
        </form>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

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
            await loadData();
        } catch (err) {
            console.error("Error al guardar en Firestore:", err);
            alert("Error de permisos o conexión al guardar.");
        }
    };
};

// Asignar eventos a botones de cabecera (usando delegación o verificación)
document.addEventListener('click', (e) => {
    if (e.target.closest('#btnAddCard')) showAddModal('card');
    if (e.target.closest('#btnAddSealed')) showAddModal('sealed');
    if (e.target.closest('#btnAddCategory')) showAddModal('category');
});

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
