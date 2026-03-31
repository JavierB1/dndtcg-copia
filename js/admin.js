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

// Referencias a tu HTML exacto
const loginForm = document.getElementById('loginForm');
const btnLogout = document.getElementById('btnLogout');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.admin-section');

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.body.className = 'auth-ready';
        await loadData();
    } else {
        document.body.className = 'auth-guest';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const msg = document.getElementById('loginMessage');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        msg.textContent = "Acceso incorrecto.";
    }
});

btnLogout.addEventListener('click', (e) => {
    e.preventDefault();
    signOut(auth).then(() => window.location.reload());
});

// --- CARGA DE DATOS ---
async function loadData() {
    const getC = (n) => collection(db, 'artifacts', appId, 'public', 'data', n);
    
    const [cSnap, sSnap, oSnap] = await Promise.all([
        getDocs(getC('cards')),
        getDocs(getC('sealed_products')),
        getDocs(getC('orders'))
    ]);

    const cards = cSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const sealed = sSnap.docs.map(d => ({id: d.id, ...d.data()}));
    const orders = oSnap.docs.map(d => ({id: d.id, ...d.data()}));

    // Dashboard
    document.getElementById('stat-total-cards').textContent = cards.length;
    document.getElementById('stat-total-orders').textContent = orders.length;
    document.getElementById('stat-total-stock').textContent = cards.reduce((acc, c) => acc + (parseInt(c.stock) || 0), 0);

    renderTables(cards, sealed, orders);
}

function renderTables(cards, sealed, orders) {
    // Render Cartas
    const cardsT = document.querySelector('#cardsTable tbody');
    cardsT.innerHTML = cards.map(c => `
        <tr>
            <td><img src="${c.imagen_url}" style="width:40px; border-radius:4px;"></td>
            <td>${c.nombre}</td>
            <td>$${c.precio}</td>
            <td>${c.stock}</td>
            <td>${c.categoria || '-'}</td>
            <td>
                <button class="row-action-btn"><i class="fas fa-edit"></i></button>
                <button class="row-action-btn delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- NAVEGACIÓN ---
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').replace('#', '');
        if (targetId === '#') return;

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        sections.forEach(s => {
            s.classList.remove('active');
            if (s.id === targetId) s.classList.add('active');
        });
    });
});
