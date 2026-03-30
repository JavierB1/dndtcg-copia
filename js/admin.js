// ==========================================================================
// GLOBAL VARIABLES (non-DOM related)
// ==========================================================================

import { initializeApp }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

let app, db, auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

const appId = firebaseConfig.projectId;
let userId = null;
let currentAdminUser = null;
let stream = null; // Para el flujo de la cámara

let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = [];

const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedProductsPage = 1;
let currentDeleteTarget = null;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn, closeSidebarBtn, sidebarMenu, sidebarOverlay, loginModal, loginForm, usernameInput, passwordInput;
let navDashboard, navCards, navSealedProducts, navCategories, navOrders, navLogout, navScanner;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection;
let cardModal, cardForm, cardId, cardName, cardImage, cardPrice, cardStock, cardCategory;
let videoPreview, startScanBtn, processingIndicator;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
    if (sectionToShow) {
        sectionToShow.classList.add('active');
    }
}

function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function showMessageModal(title, text) {
    const titleEl = document.getElementById('messageModalTitle');
    const textEl = document.getElementById('messageModalText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    openModal(document.getElementById('messageModal'));
}

// ==========================================================================
// CAMERA & SCANNER LOGIC
// ==========================================================================

async function startCamera() {
    if (!videoPreview) return;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        videoPreview.srcObject = stream;
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        showMessageModal("Error de Cámara", "No se pudo acceder a la cámara. Revisa los permisos.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function handleScan() {
    if (!startScanBtn || !processingIndicator) return;

    processingIndicator.style.display = 'block';
    startScanBtn.disabled = true;

    // Simulación de OCR / Reconocimiento
    setTimeout(() => {
        processingIndicator.style.display = 'none';
        startScanBtn.disabled = false;

        // Simulamos que encontró una carta que ya existe en nuestro array de Firestore
        // O una nueva basada en una base de datos externa
        const foundCard = {
            nombre: "Carta Escaneada Ejemplo",
            precio: 15.00,
            imagen_url: "https://placehold.co/400x600/2d3748/white?text=Carta+Escaneada",
            categoria: allCategories.length > 0 ? allCategories[0].name : "",
            stock: 1
        };

        // Abrir el modal de cartas y rellenar datos
        document.getElementById('cardModalTitle').textContent = "Nueva Carta (Escaneada)";
        cardId.value = '';
        cardName.value = foundCard.nombre;
        cardImage.value = foundCard.imagen_url;
        cardPrice.value = foundCard.precio;
        cardStock.value = foundCard.stock;
        cardCategory.value = foundCard.categoria;
        
        openModal(cardModal);
    }, 2000);
}

// ==========================================================================
// FIREBASE AUTHENTICATION
// ==========================================================================

async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput.value;
    const password = passwordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (error) {
        console.error('Error Login:', error);
        const msg = document.getElementById('loginMessage');
        msg.textContent = "Credenciales incorrectas.";
        msg.style.display = 'block';
    }
}

// ==========================================================================
// DATA LOADING
// ==========================================================================

async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    await loadSealedProductsData();
    await loadOrdersData();
}

async function loadCategories() {
    try {
        const col = collection(db, `artifacts/${appId}/public/data/categories`);
        const snap = await getDocs(col);
        allCategories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateFilters();
        renderCategoriesTable();
    } catch (e) { console.error(e); }
}

async function loadCardsData() {
    try {
        const col = collection(db, `artifacts/${appId}/public/data/cards`);
        const snap = await getDocs(col);
        allCards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCardsTable();
        updateStats();
    } catch (e) { console.error(e); }
}

async function loadSealedProductsData() {
    try {
        const col = collection(db, `artifacts/${appId}/public/data/sealed_products`);
        const snap = await getDocs(col);
        allSealedProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSealedProductsTable();
        updateStats();
    } catch (e) { console.error(e); }
}

async function loadOrdersData() {
    try {
        const col = collection(db, `artifacts/${appId}/public/data/orders`);
        const snap = await getDocs(col);
        allOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrdersTable();
    } catch (e) { console.error(e); }
}

// ==========================================================================
// RENDERING & UI UPDATES
// ==========================================================================

function populateFilters() {
    const cats = allCategories.map(c => c.name);
    [document.getElementById('adminCategoryFilter'), document.getElementById('adminSealedCategoryFilter')].forEach(f => {
        if (!f) return;
        f.innerHTML = '<option value="">Todas</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    });
    [cardCategory, document.getElementById('sealedProductCategory')].forEach(s => {
        if (!s) return;
        s.innerHTML = '<option value="" disabled selected>Seleccionar</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    });
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allCards.map(card => `
        <tr>
            <td>${card.id}</td>
            <td><img src="${card.imagen_url}" width="40"></td>
            <td>${card.nombre}</td>
            <td>$${parseFloat(card.precio).toFixed(2)}</td>
            <td>${card.stock}</td>
            <td>${card.categoria}</td>
            <td class="action-buttons">
                <button class="edit-button" onclick="window.editCard('${card.id}')">Editar</button>
            </td>
        </tr>
    `).join('');
}

function updateStats() {
    if (document.getElementById('totalCardsCount')) document.getElementById('totalCardsCount').textContent = allCards.length;
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    
    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    scannerSection = document.getElementById('scanner-section');
    
    navDashboard = document.getElementById('nav-dashboard');
    navCards = document.getElementById('nav-cards');
    navScanner = document.getElementById('nav-scanner');

    videoPreview = document.getElementById('video-preview');
    startScanBtn = document.getElementById('startScanBtn');
    processingIndicator = document.getElementById('processing-indicator');

    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');

    // Eventos de Navegación
    if (navDashboard) navDashboard.addEventListener('click', () => { showSection(dashboardSection); stopCamera(); });
    if (navCards) navCards.addEventListener('click', () => { showSection(cardsSection); stopCamera(); });
    if (navScanner) navScanner.addEventListener('click', () => { showSection(scannerSection); startCamera(); });

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (startScanBtn) startScanBtn.addEventListener('click', handleScan);

    // Logout
    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await signOut(auth);
        location.reload();
    });

    openModal(loginModal);
});

// Global helpers
window.editCard = (id) => {
    const card = allCards.find(c => c.id === id);
    if (card) {
        cardId.value = card.id;
        cardName.value = card.nombre;
        cardImage.value = card.imagen_url;
        cardPrice.value = card.precio;
        cardStock.value = card.stock;
        cardCategory.value = card.categoria;
        openModal(cardModal);
    }
};
