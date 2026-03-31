// ==========================================================================
// GLOBAL VARIABLES AND DOM REFERENCES
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, addDoc, runTransaction, getDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.appspot.com",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

const apiKey = ""; // API Key para Gemini (inyectada en runtime)

let app, db, auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

const appId = firebaseConfig.projectId;
let currentUser = null;

// Estados Globales
let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = [];
let cart = JSON.parse(localStorage.getItem('cart')) || {};
let currentDeliveryMethod = 'delivery';

// Paginación
let currentCardsPage = 1;
let currentSealedProductsPage = 1;
const itemsPerPage = 10;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================

const navLinks = {
    dashboard: document.getElementById('nav-dashboard'),
    scanner: document.getElementById('nav-scanner'),
    scannerQuick: document.getElementById('nav-scanner-quick'),
    cards: document.getElementById('nav-cards'),
    sealed: document.getElementById('nav-sealed-products'),
    categories: document.getElementById('nav-categories'),
    orders: document.getElementById('nav-orders')
};

const sections = {
    dashboard: document.getElementById('dashboard-section'),
    scanner: document.getElementById('scanner-section'),
    cards: document.getElementById('cards-section'),
    sealed: document.getElementById('sealed-products-section'),
    categories: document.getElementById('categories-section'),
    orders: document.getElementById('orders-section')
};

// Escáner
const videoPreview = document.getElementById('video-preview');
const startScanBtn = document.getElementById('startScanBtn');

// Modales y Formularios
const cardModal = document.getElementById('cardModal');
const cardForm = document.getElementById('cardForm');
const cardsContainer = document.getElementById('cardsContainer');
const sealedProductsContainer = document.getElementById('sealedProductsContainer');
const modalCarrito = document.getElementById('modalCarrito');
const listaCarrito = document.getElementById('lista-carrito');

// ==========================================================================
// NAVIGATION & UI CONTROL
// ==========================================================================

function showSection(sectionId) {
    Object.values(sections).forEach(section => {
        if (section) section.classList.remove('active');
    });
    if (sections[sectionId]) {
        sections[sectionId].classList.add('active');
    }
    if (sectionId !== 'scanner') stopScanner();
}

// ==========================================================================
// AI SCANNER LOGIC
// ==========================================================================

let cameraStream = null;

async function startScanner() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        if (videoPreview) {
            videoPreview.srcObject = cameraStream;
            showSection('scanner');
        }
    } catch (err) {
        showMessageModal("Error", "No se pudo activar la cámara para el escaneo.");
    }
}

function stopScanner() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

async function captureAndAnalyze() {
    if (!videoPreview) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = videoPreview.videoWidth;
    canvas.height = videoPreview.videoHeight;
    context.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    
    startScanBtn.disabled = true;
    startScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';

    try {
        const result = await callGeminiWithRetry(base64Image);
        if (result) {
            stopScanner();
            showSection('cards');
            // Simular clic en añadir para abrir modal
            document.getElementById('addCardBtn').click();
            setTimeout(() => {
                document.getElementById('cardName').value = result.nombre || '';
                document.getElementById('cardSetCode').value = result.codigo || '';
            }, 100);
            showMessageModal("Carta Identificada", `Se ha detectado: ${result.nombre}`);
        }
    } catch (error) {
        showMessageModal("Error", "No se pudo identificar la carta.");
    } finally {
        startScanBtn.disabled = false;
        startScanBtn.innerHTML = '<i class="fas fa-bullseye"></i> Capturar e Identificar';
    }
}

async function callGeminiWithRetry(base64Data, retries = 5, delay = 1000) {
    const prompt = "Actúa como un experto en TCG. Identifica esta carta. Devuelve un objeto JSON con: 'nombre', 'codigo' (número de carta 000/000) y 'categoria'.";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }],
        generationConfig: { responseMimeType: "application/json" }
    };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
            const data = await response.json();
            return JSON.parse(data.candidates[0].content.parts[0].text);
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

// ==========================================================================
// DATA LOADING & RENDERING
// ==========================================================================

async function loadInitialData() {
    if (!db) return;
    try {
        const [catSnap, cardSnap, sealedSnap, orderSnap] = await Promise.all([
            getDocs(collection(db, `artifacts/${appId}/public/data/categories`)),
            getDocs(collection(db, `artifacts/${appId}/public/data/cards`)),
            getDocs(collection(db, `artifacts/${appId}/public/data/sealed_products`)),
            getDocs(collection(db, `artifacts/${appId}/public/data/orders`))
        ]);

        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allSealedProducts = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderCards();
        renderSealedProducts();
        renderAdminCardsTable();
        updateDashboardStats();
        populateCategorySelects();
    } catch (e) { console.error("Error loading data:", e); }
}

function renderCards() {
    if (!cardsContainer) return;
    cardsContainer.innerHTML = '';
    allCards.forEach(card => {
        const div = document.createElement('div');
        div.className = 'carta';
        div.innerHTML = `
            <img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.src='https://placehold.co/180x250?text=No+Image'">
            <div class="card-info-header">
                <h4>${card.nombre}</h4>
                <span class="card-code-cell">${card.codigo || 'N/A'}</span>
            </div>
            <p>Precio: $${parseFloat(card.precio).toFixed(2)}</p>
            <p>Stock: ${card.stock}</p>
            <div class="quantity-controls">
                <button class="qty-btn" data-action="dec" data-id="${card.id}">-</button>
                <input type="number" value="1" min="1" id="qty-${card.id}">
                <button class="qty-btn" data-action="inc" data-id="${card.id}">+</button>
            </div>
            <button class="agregar-carrito" data-id="${card.id}" data-type="card">Añadir al Carrito</button>
        `;
        cardsContainer.appendChild(div);
    });
}

function renderSealedProducts() {
    if (!sealedProductsContainer) return;
    sealedProductsContainer.innerHTML = '';
    allSealedProducts.forEach(product => {
        const div = document.createElement('div');
        div.className = 'carta';
        div.innerHTML = `
            <img src="${product.imagen_url}" alt="${product.nombre}">
            <h4>${product.nombre}</h4>
            <p>Precio: $${parseFloat(product.precio).toFixed(2)}</p>
            <p>Stock: ${product.stock}</p>
            <button class="agregar-carrito" data-id="${product.id}" data-type="sealed">Añadir al Carrito</button>
        `;
        sealedProductsContainer.appendChild(div);
    });
}

function renderAdminCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allCards.map(card => `
        <tr>
            <td>${card.id.substring(0,5)}...</td>
            <td><img src="${card.imagen_url}" width="40" style="border-radius:4px;"></td>
            <td>${card.nombre}</td>
            <td>${card.codigo || 'N/A'}</td>
            <td>$${parseFloat(card.precio).toFixed(2)}</td>
            <td>${card.stock}</td>
            <td>
                <button class="btn-edit" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" data-id="${card.id}"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ==========================================================================
// CARRITO & WHATSAPP LOGIC
// ==========================================================================

function updateCartCounter() {
    const total = Object.values(cart).reduce((acc, item) => acc + item.quantity, 0);
    document.querySelectorAll('.cart-counter').forEach(c => {
        c.textContent = total;
        c.classList.toggle('active', total > 0);
    });
}

function renderCarrito() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = '';
    let subtotal = 0;

    Object.values(cart).forEach(item => {
        const info = item.type === 'card' ? allCards.find(c => c.id === item.id) : allSealedProducts.find(p => p.id === item.id);
        if (!info) return;
        const totalItem = info.precio * item.quantity;
        subtotal += totalItem;

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="cart-item-info">
                <span>${info.nombre} x${item.quantity}</span>
                <span>$${totalItem.toFixed(2)}</span>
            </div>
            <button class="remove-item" data-id="${item.id}">&times;</button>
        `;
        listaCarrito.appendChild(li);
    });

    const totalElement = document.getElementById('total-carrito');
    if (totalElement) totalElement.textContent = subtotal.toFixed(2);
}

function enviarWhatsApp() {
    const phone = "50372270342";
    let message = "¡Hola! Quisiera realizar el siguiente pedido:\n\n";
    let total = 0;

    Object.values(cart).forEach(item => {
        const info = item.type === 'card' ? allCards.find(c => c.id === item.id) : allSealedProducts.find(p => p.id === item.id);
        if (info) {
            message += `- ${info.nombre} (${item.quantity} unidades): $${(info.precio * item.quantity).toFixed(2)}\n`;
            total += info.precio * item.quantity;
        }
    });

    message += `\n*Total: $${total.toFixed(2)}*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

// ==========================================================================
// INITIALIZATION & EVENTS
// ==========================================================================

function showMessageModal(title, text) {
    const m = document.getElementById('messageModal');
    if (m) {
        document.getElementById('messageModalTitle').textContent = title;
        document.getElementById('messageModalText').textContent = text;
        m.style.display = 'flex';
    }
}

function populateCategorySelects() {
    const sel = document.getElementById('cardCategory');
    if (sel) sel.innerHTML = allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function updateDashboardStats() {
    const tc = document.getElementById('totalCardsCount');
    const ts = document.getElementById('totalSealedProductsCount');
    const uc = document.getElementById('uniqueCategoriesCount');
    if (tc) tc.textContent = allCards.length;
    if (ts) ts.textContent = allSealedProducts.length;
    if (uc) uc.textContent = allCategories.length;
}

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) await signInAnonymously(auth);
        await loadInitialData();
        updateCartCounter();
    });

    // Navegación Sidebar
    navLinks.dashboard?.addEventListener('click', (e) => { e.preventDefault(); showSection('dashboard'); });
    navLinks.scanner?.addEventListener('click', (e) => { e.preventDefault(); startScanner(); });
    navLinks.scannerQuick?.addEventListener('click', startScanner);
    navLinks.cards?.addEventListener('click', (e) => { e.preventDefault(); showSection('cards'); });
    navLinks.sealed?.addEventListener('click', (e) => { e.preventDefault(); showSection('sealed'); });
    navLinks.categories?.addEventListener('click', (e) => { e.preventDefault(); showSection('categories'); });
    navLinks.orders?.addEventListener('click', (e) => { e.preventDefault(); showSection('orders'); });

    // Escáner
    startScanBtn?.addEventListener('click', captureAndAnalyze);

    // Carrito
    document.getElementById('abrirCarrito')?.addEventListener('click', () => { renderCarrito(); modalCarrito.style.display = 'flex'; });
    document.getElementById('cerrarCarrito')?.addEventListener('click', () => modalCarrito.style.display = 'none');
    document.getElementById('vaciarCarrito')?.addEventListener('click', () => { cart = {}; localStorage.removeItem('cart'); updateCartCounter(); renderCarrito(); });
    document.getElementById('openCheckoutModalBtn')?.addEventListener('click', enviarWhatsApp);

    // Delegación de Eventos
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.classList.contains('agregar-carrito')) {
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const qtyInput = document.getElementById(`qty-${id}`);
            const qty = qtyInput ? parseInt(qtyInput.value) : 1;
            
            cart[id] = { id, type, quantity: (cart[id]?.quantity || 0) + qty };
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCounter();
            
            const notify = document.getElementById('addedToCartNotification');
            if (notify) { notify.classList.add('show'); setTimeout(() => notify.classList.remove('show'), 2000); }
        }

        if (btn.classList.contains('qty-btn')) {
            const input = document.getElementById(`qty-${btn.dataset.id}`);
            if (btn.dataset.action === 'inc') input.value = parseInt(input.value) + 1;
            else if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
        }

        if (btn.classList.contains('remove-item')) {
            delete cart[btn.dataset.id];
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCounter();
            renderCarrito();
        }
    });

    // Cerrar modales con X
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.admin-modal, .modal').style.display = 'none');
    });

    document.getElementById('okMessageModal')?.addEventListener('click', () => {
        document.getElementById('messageModal').style.display = 'none';
    });
});
