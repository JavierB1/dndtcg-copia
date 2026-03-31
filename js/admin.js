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
    getDocs 
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

// --- GESTIÓN DE SESIÓN ---

// Al cargar, ponemos estado loading para evitar parpadeos
document.body.className = 'auth-loading';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Sesión iniciada:", user.email);
        // Quitamos cualquier rastro del login y mostramos el panel
        document.body.classList.remove('auth-guest', 'auth-loading');
        document.body.classList.add('auth-ready');
        await loadData();
    } else {
        console.log("No hay sesión activa");
        // Mostramos el login en pantalla completa
        document.body.classList.remove('auth-ready', 'auth-loading');
        document.body.classList.add('auth-guest');
    }
});

// Login
if (elements.loginForm) {
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const btn = document.getElementById('btnLoginSubmit');

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = "Cargando...";
            }
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            console.error("Error de login:", err);
            if (elements.loginMessage) {
                elements.loginMessage.textContent = "Error: Credenciales incorrectas.";
                elements.loginMessage.style.color = "#ef4444";
            }
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Entrar al Panel";
            }
        }
    });
}

// Logout
if (elements.btnLogout) {
    elements.btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            // Forzamos recarga para limpiar estados
            window.location.reload();
        } catch (err) {
            console.error("Error al cerrar sesión", err);
        }
    });
}

// --- CARGA DE DATOS ---

async function loadData() {
    console.log("Cargando datos desde Firestore...");
    // Función auxiliar para las rutas correctas de la colección según las reglas
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

        // Actualizar Estadísticas con seguridad de que el elemento existe
        if (elements.statCards) elements.statCards.textContent = cards.length;
        if (elements.statOrders) elements.statOrders.textContent = orders.length;
        if (elements.statStock) {
            const totalStock = cards.reduce((acc, c) => acc + (Number(c.stock) || 0), 0);
            elements.statStock.textContent = totalStock;
        }

        renderAllTables(cards, sealed, orders, categories);

    } catch (err) {
        console.error("Error en loadData:", err);
    }
}

function renderAllTables(cards, sealed, orders, categories) {
    // Render de Tabla Cartas
    if (elements.cardsTableBody) {
        elements.cardsTableBody.innerHTML = cards.length ? cards.map(c => `
            <tr>
                <td><img src="${c.imagen_url || ''}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;" onerror="this.src='https://via.placeholder.com/40'"></td>
                <td>${c.nombre || 'Sin nombre'}</td>
                <td>$${Number(c.precio || 0).toFixed(2)}</td>
                <td>${c.stock || 0}</td>
                <td>${c.categoria || '-'}</td>
                <td>
                    <button class="row-action-btn"><i class="fas fa-edit"></i></button>
                    <button class="row-action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8;">No hay cartas registradas</td></tr>';
    }

    // Render de Productos Sellados
    if (elements.sealedTableBody) {
        elements.sealedTableBody.innerHTML = sealed.length ? sealed.map(p => `
            <tr>
                <td>${p.nombre || 'Sin nombre'}</td>
                <td>$${Number(p.precio || 0).toFixed(2)}</td>
                <td>${p.stock || 0}</td>
                <td>
                    <button class="row-action-btn"><i class="fas fa-edit"></i></button>
                    <button class="row-action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No hay productos sellados</td></tr>';
    }

    // Render de Categorías
    if (elements.categoriesTableBody) {
        elements.categoriesTableBody.innerHTML = categories.length ? categories.map(cat => `
            <tr>
                <td style="font-family:monospace; font-size:0.8rem; color:#6366f1;">${cat.id}</td>
                <td>${cat.nombre || 'Sin nombre'}</td>
                <td>
                    <button class="row-action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">No hay categorías</td></tr>';
    }

    // Render de Pedidos
    if (elements.ordersTableBody) {
        elements.ordersTableBody.innerHTML = orders.length ? orders.map(o => `
            <tr>
                <td style="font-family:monospace; font-size:0.8rem;">${o.id.substring(0,8)}...</td>
                <td>${o.cliente_nombre || 'Usuario'}</td>
                <td>$${Number(o.total || 0).toFixed(2)}</td>
                <td><span style="background:rgba(99,102,241,0.2); color:#818cf8; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">${o.estado || 'pendiente'}</span></td>
                <td>
                    <button class="row-action-btn"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No hay pedidos</td></tr>';
    }
}

// --- NAVEGACIÓN ---

elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        
        e.preventDefault();
        const targetId = href.replace('#', '');

        // Cambiar estado visual de los links
        elements.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Mostrar sección correspondiente
        elements.sections.forEach(s => {
            s.classList.remove('active');
            if (s.id === targetId) s.classList.add('active');
        });
    });
});
