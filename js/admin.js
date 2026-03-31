import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut,
    setPersistence,
    browserSessionPersistence 
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

// --- CONFIGURACIÓN DE SEGURIDAD (LOGIN OBLIGATORIO) ---

// Forzamos a que la sesión SOLO dure mientras la pestaña esté abierta y no se recargue
setPersistence(auth, browserSessionPersistence)
    .then(() => {
        console.log("Persistencia configurada: Solo sesión actual.");
    })
    .catch((error) => {
        console.error("Error configurando persistencia:", error);
    });

// Al cargar la página, ponemos el estado en "loading"
document.body.className = 'auth-loading';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuario autenticado
        document.body.classList.replace('auth-loading', 'auth-ready');
        if (elements.loginModal) elements.loginModal.style.display = 'none';
        if (elements.adminPanelContainer) elements.adminPanelContainer.style.display = 'flex';
        await loadData();
    } else {
        // No hay usuario o se cerró la sesión
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
            if (btn) { btn.disabled = true; btn.innerText = "Verificando..."; }
            // Al hacer login con setPersistence activo, se aplicará la regla de sesión corta
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            console.error("Error en login:", err);
            if (elements.loginMessage) {
                elements.loginMessage.textContent = "Acceso denegado. Intente de nuevo.";
            }
            if (btn) { btn.disabled = false; btn.innerText = "Entrar al Panel"; }
        }
    });
}

// Lógica de Logout explícito
if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.reload();
    });
}

// --- CARGA Y RENDERIZADO ---

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
            const totalStock = cards.reduce((acc, c) => acc + (Number(c.stock) || 0), 0) + 
                               sealed.reduce((acc, s) => acc + (Number(s.stock) || 0), 0);
            elements.statStock.textContent = totalStock;
        }

        renderAllTables(cards, sealed, orders, categories);
    } catch (err) {
        console.error("Error cargando Firestore:", err);
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
                <td>${c.categoria || 'General'}</td>
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
                <td style="font-family:monospace; font-size:0.8rem;">${cat.id.substring(0,8)}</td>
                <td>${cat.nombre || 'Sin nombre'}</td>
                <td><button class="row-action-btn delete"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    }

    if (elements.ordersTableBody) {
        elements.ordersTableBody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.id.substring(0,6)}</td>
                <td>${o.cliente_nombre || 'Cliente'}</td>
                <td>$${Number(o.total || 0).toFixed(2)}</td>
                <td><span class="status-tag">${o.estado || 'Recibido'}</span></td>
                <td><button class="row-action-btn"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('');
    }
}

// --- MODALES DE AGREGAR ---

const showAddModal = (type) => {
    let title = "";
    let fields = [];
    let colName = "";

    if (type === 'card') {
        title = "Nueva Carta"; colName = "cards";
        fields = [
            {id: 'nombre', label: 'Nombre', type: 'text'},
            {id: 'precio', label: 'Precio', type: 'number'},
            {id: 'stock', label: 'Stock', type: 'number'},
            {id: 'categoria', label: 'Categoría', type: 'text'},
            {id: 'imagen_url', label: 'URL Imagen', type: 'text'}
        ];
    } else if (type === 'sealed') {
        title = "Nuevo Producto"; colName = "sealed_products";
        fields = [
            {id: 'nombre', label: 'Nombre', type: 'text'},
            {id: 'precio', label: 'Precio', type: 'number'},
            {id: 'stock', label: 'Stock', type: 'number'}
        ];
    } else {
        title = "Nueva Categoría"; colName = "categories";
        fields = [{id: 'nombre', label: 'Nombre', type: 'text'}];
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-custom';
    overlay.style = "position:fixed; inset:0; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; backdrop-filter:blur(5px);";
    
    overlay.innerHTML = `
        <div style="background:#1e293b; padding:2rem; border-radius:1rem; width:100%; max-width:400px; border:1px solid #334155;">
            <h2 style="color:white; margin-bottom:1.5rem; font-size:1.25rem;">${title}</h2>
            <form id="formAdd">
                ${fields.map(f => `
                    <div style="margin-bottom:1rem;">
                        <label style="display:block; color:#94a3b8; font-size:0.7rem; margin-bottom:0.4rem;">${f.label.toUpperCase()}</label>
                        <input type="${f.type}" id="f-${f.id}" step="0.01" style="width:100%; background:#0f172a; border:1px solid #334155; color:white; padding:0.6rem; border-radius:0.4rem;" required>
                    </div>
                `).join('')}
                <div style="display:flex; gap:10px; margin-top:1.5rem;">
                    <button type="button" id="closeM" style="flex:1; background:#334155; color:white; border-radius:0.4rem; padding:0.6rem;">Cancelar</button>
                    <button type="submit" style="flex:1; background:#6366f1; color:white; border-radius:0.4rem; padding:0.6rem; font-weight:bold;">Guardar</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById('closeM').onclick = () => overlay.remove();
    document.getElementById('formAdd').onsubmit = async (e) => {
        e.preventDefault();
        const data = { createdAt: serverTimestamp() };
        fields.forEach(f => {
            const val = document.getElementById(`f-${f.id}`).value;
            data[f.id] = f.type === 'number' ? Number(val) : val;
        });
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', colName), data);
            overlay.remove();
            loadData();
        } catch (err) { alert("Error al guardar."); }
    };
};

// Eventos globales para botones "+"
document.addEventListener('click', (e) => {
    if (e.target.closest('#btnAddCard')) showAddModal('card');
    if (e.target.closest('#btnAddSealed')) showAddModal('sealed');
    if (e.target.closest('#btnAddCategory')) showAddModal('category');
});

// Navegación
elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();
        elements.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        elements.sections.forEach(s => {
            s.classList.remove('active');
            if (s.id === href.replace('#', '')) s.classList.add('active');
        });
    });
});
