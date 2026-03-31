// ==========================================================================
// GLOBAL VARIABLES (non-DOM related)
// ==========================================================================

// Firebase and Firestore SDK imports
import { initializeApp }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

// Configuración de Firebase - Directamente proporcionada
const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

let app;
let db;
let auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    console.error("Error: firebaseConfig no está disponible o no tiene un 'projectId'. No se pudo inicializar la app.");
}

const appId = firebaseConfig.projectId;
let userId = null;
let currentAdminUser = null;

let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = []; 

const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedProductsPage = 1;

let currentDeleteTarget = null;
let ocrWorker = null; 

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn, closeSidebarBtn, sidebarMenu, sidebarOverlay;
let loginModal, loginForm, loginMessage, usernameInput, passwordInput, togglePasswordVisibilityBtn; 
let navDashboard, navCards, navSealedProducts, navCategories, navOrders, navLogout;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection; 
let addCardBtn, addSealedProductBtn, addCategoryBtn;
let cardModal, cardModalTitle, cardForm, cardId, cardName, cardCode, cardExpansion, cardImage, cardPrice, cardStock, cardCategory, saveCardBtn;
let sealedProductModal, sealedProductModalTitle, sealedProductForm, sealedProductId, sealedProductName, sealedProductImage, sealedProductCategory, sealedProductPrice, sealedProductStock, saveSealedProductBtn;
let categoryModal, categoryModalTitle, categoryForm, categoryId, categoryName, saveCategoryBtn;
let confirmModal, confirmMessage, cancelDeleteBtn, confirmDeleteBtn;
let cardsTable, sealedProductsTable, categoriesTable, ordersTable; 
let adminSearchInput, adminCategoryFilter, adminPrevPageBtn, adminNextPageBtn, adminPageInfo;
let totalCardsCount, totalSealedProductsCount, outOfStockCount, uniqueCategoriesCount;
let messageModal, closeMessageModalBtn, messageModalTitle, messageModalText, okMessageModalBtn;
let orderDetailsModal, closeOrderDetailsModalBtn, orderDetailsContent, orderStatusSelect, updateOrderStatusBtn;

// REFERENCIAS DEL ESCÁNER DE CÁMARA
let scannerModal, openScannerBtn, closeScannerBtn, cameraStream, captureCanvas, scannerStatusMessage;
let mediaStream = null, scanTimeout = null;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => section?.classList.remove('active'));
    sectionToShow?.classList.add('active');
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

function showLoginError(message) {
    if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.style.display = 'block';
    }
}

function clearLoginError() {
    if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.style.display = 'none';
    }
}

function showMessageModal(title, text) {
    if (messageModalTitle) messageModalTitle.textContent = title;
    if (messageModalText) messageModalText.textContent = text;
    openModal(messageModal);
}

// ==========================================================================
// FUNCIÓN DE ESCÁNER MEJORADO (NOMBRE + CÓDIGO + TOTAL)
// ==========================================================================

async function initTesseractAPI() {
    if (!window.Tesseract) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    if (!ocrWorker) {
        ocrWorker = await Tesseract.createWorker('eng');
    }
}

async function startCamera() {
    try {
        scannerStatusMessage.textContent = "Iniciando cámara...";
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        cameraStream.srcObject = mediaStream;
        await initTesseractAPI();
        startScanningProcess();
    } catch (err) {
        scannerStatusMessage.textContent = "Error: Acceso a cámara denegado.";
        scannerStatusMessage.style.color = "#ef4444";
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (scanTimeout) clearTimeout(scanTimeout);
}

async function startScanningProcess() {
    scannerStatusMessage.innerHTML = "<strong>ENFOCA LA CARTA</strong><br><small>Alinea el nombre arriba y el código abajo en el centro.</small>";
    scannerStatusMessage.style.color = "#10b981";
    scanTimeout = setTimeout(processScannedFrame, 2000); 
}

async function processScannedFrame() {
    if (!mediaStream || !ocrWorker) return;

    try {
        scannerStatusMessage.innerHTML = "Identificando carta...";
        scannerStatusMessage.style.color = "#f59e0b";

        const context = captureCanvas.getContext('2d');
        const vW = cameraStream.videoWidth;
        const vH = cameraStream.videoHeight;

        // Capturamos un área central más amplia para leer nombre (arriba) y número (abajo)
        const cropW = vW * 0.7;
        const cropH = vH * 0.8;
        const startX = (vW - cropW) / 2;
        const startY = (vH - cropH) / 2;

        captureCanvas.width = cropW * 1.5;
        captureCanvas.height = cropH * 1.5;

        context.filter = 'contrast(1.4) grayscale(0.8)';
        context.drawImage(cameraStream, startX, startY, cropW, cropH, 0, 0, captureCanvas.width, captureCanvas.height);
        context.filter = 'none';

        const result = await ocrWorker.recognize(captureCanvas);
        const text = result.data.text;
        
        console.log("IA leyó lo siguiente:\n", text);

        // BUSCAMOS PATRONES
        const numberMatch = text.match(/([a-zA-Z0-9]{1,4})\s*\/\s*(\d{1,3})/);
        // El nombre suele estar al principio de las líneas y en mayúsculas/títulos
        const words = text.split(/\n|\s/).filter(w => w.length > 3 && /^[A-Z]/.test(w));
        const possibleName = words.length > 0 ? words[0] : "";

        if (numberMatch) {
            let cardNumber = numberMatch[1].replace(/^0+/, ''); 
            let setTotal = numberMatch[2]; 

            scannerStatusMessage.innerHTML = `Detectado: <strong>${numberMatch[0]}</strong><br><small>Buscando coincidencias...</small>`;
            scannerStatusMessage.style.color = "#3b82f6";

            const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:${cardNumber}`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // PRIORIDAD 1: Coincidencia de nombre + número
                let bestMatch = data.data.find(c => 
                    c.name.toLowerCase().includes(possibleName.toLowerCase()) || 
                    possibleName.toLowerCase().includes(c.name.toLowerCase())
                );

                // PRIORIDAD 2: Coincidencia de total impreso
                if (!bestMatch) {
                    bestMatch = data.data.find(c => c.set.printedTotal == setTotal);
                }

                // PRIORIDAD 3: La primera opción de la API
                if (!bestMatch) bestMatch = data.data[0];

                fillFormWithAPIData(bestMatch, numberMatch[0]);
            } else {
                scannerStatusMessage.innerHTML = "Código no hallado. Reintentando...";
                scanTimeout = setTimeout(processScannedFrame, 1500);
            }
        } else {
            scannerStatusMessage.innerHTML = "No veo el código...<br><small>Ajusta la distancia (aprox 15cm).</small>";
            scanTimeout = setTimeout(processScannedFrame, 1500); 
        }
    } catch (error) {
        console.error(error);
        scanTimeout = setTimeout(processScannedFrame, 1500);
    }
}

function fillFormWithAPIData(card, originalCode) {
    stopCamera();
    closeModal(scannerModal);
    openModal(cardModal);
    cardModalTitle.textContent = '¡Carta Identificada!';

    cardName.value = card.name;
    cardCode.value = originalCode || card.number;
    cardExpansion.value = card.set.name;
    cardImage.value = card.images.large || card.images.small || '';

    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        price = p[Object.keys(p)[0]].market || 0;
    }
    cardPrice.value = parseFloat(price).toFixed(2);
    cardCategory.value = 'Pokémon TCG';

    [cardName, cardCode, cardExpansion, cardImage].forEach(f => {
        f.style.backgroundColor = '#ecfdf5';
        setTimeout(() => f.style.backgroundColor = '', 2000);
    });
}

// ==========================================================================
// FIREBASE AUTH & DATA (Igual que antes)
// ==========================================================================

async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    clearLoginError();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (e) {
        showLoginError('Credenciales inválidas.');
    }
}

async function handleLogout() {
    await signOut(auth);
    hideAllSections();
    openModal(loginModal);
}

onAuthStateChanged(auth, (user) => {
    userId = user ? user.uid : null;
});

async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    await loadSealedProductsData();
    await loadOrdersData();
}

async function loadCategories() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/categories`));
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateFilters();
    renderCategoriesTable();
}

function populateFilters() {
    const names = allCategories.map(c => c.name);
    adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona un Juego</option>';
    names.forEach(n => {
        adminCategoryFilter.appendChild(new Option(n, n));
        cardCategory.appendChild(new Option(n, n));
    });
}

async function loadCardsData() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/cards`));
    allCards = snap.docs.map(d => ({ id: d.id, ...d.data(), precio: parseFloat(d.data().precio) || 0, stock: parseInt(d.data().stock) || 0 }));
    renderCardsTable();
    updateStats();
}

async function loadSealedProductsData() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/sealed_products`));
    allSealedProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSealedProductsTable();
}

async function loadOrdersData() {
    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/orders`));
    allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp);
    renderOrdersTable();
}

function renderCardsTable() {
    const tbody = cardsTable.querySelector('tbody');
    tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id}</td>
            <td><img src="${c.imagen_url}" width="40"></td>
            <td>${c.nombre}</td>
            <td>${c.codigo}</td>
            <td>${c.expansion || ''}</td>
            <td>$${c.precio.toFixed(2)}</td>
            <td>${c.stock}</td>
            <td>${c.categoria}</td>
            <td class="action-buttons">
                <button class="action-btn edit edit-card-btn" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete delete-card-btn" data-id="${c.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function renderSealedProductsTable() {
    const tbody = sealedProductsTable.querySelector('tbody');
    tbody.innerHTML = '';
    allSealedProducts.forEach(p => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${p.id}</td><td><img src="${p.imagen_url}" width="40"></td><td>${p.nombre}</td><td>${p.categoria}</td><td>$${parseFloat(p.precio).toFixed(2)}</td><td>${p.stock}</td><td>Acciones</td>`;
    });
}

function renderCategoriesTable() {
    const tbody = categoriesTable.querySelector('tbody');
    tbody.innerHTML = '';
    allCategories.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${c.name}</td><td>Acciones</td>`;
    });
}

function renderOrdersTable() {
    const tbody = ordersTable.querySelector('tbody');
    tbody.innerHTML = '';
    allOrders.forEach(o => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${o.id}</td><td>${new Date(o.timestamp).toLocaleString()}</td><td>${o.customerName}</td><td>$${parseFloat(o.total).toFixed(2)}</td><td>${o.status}</td><td>Acciones</td>`;
    });
}

function updateStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
}

function hideAllSections() {
    [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection].forEach(s => s?.classList.remove('active'));
}

async function handleSaveCard(e) {
    e.preventDefault();
    const data = {
        nombre: cardName.value, codigo: cardCode.value, expansion: cardExpansion.value,
        imagen_url: cardImage.value, precio: cardPrice.value, stock: cardStock.value, categoria: cardCategory.value
    };
    if (cardId.value) await updateDoc(doc(db, `artifacts/${appId}/public/data/cards`, cardId.value), data);
    else await addDoc(collection(db, `artifacts/${appId}/public/data/cards`), data);
    cardForm.reset(); closeModal(cardModal); await loadCardsData();
}

// ==========================================================================
// DOM LOAD & EVENTS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Inyección de estilos para iPad/Móvil
    const style = document.createElement('style');
    style.innerHTML = `@media(max-width:768px){.sidebar{position:fixed;left:-260px;z-index:100;transition:0.3s}.sidebar.show{left:0}.main-content{margin-left:0}.admin-modal-content{width:95%}}`;
    document.head.appendChild(style);

    // Asignaciones
    sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    closeSidebarBtn = document.getElementById('closeSidebarBtn');
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    loginMessage = document.getElementById('loginMessage');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    navDashboard = document.getElementById('nav-dashboard');
    navCards = document.getElementById('nav-cards');
    navSealedProducts = document.getElementById('nav-sealed-products');
    navCategories = document.getElementById('nav-categories');
    navOrders = document.getElementById('nav-orders');
    navLogout = document.getElementById('nav-logout');
    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    sealedProductsSection = document.getElementById('sealed-products-section');
    categoriesSection = document.getElementById('categories-section');
    ordersSection = document.getElementById('orders-section');
    addCardBtn = document.getElementById('addCardBtn');
    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardCode = document.getElementById('cardCode');
    cardExpansion = document.getElementById('cardExpansion');
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');
    cardsTable = document.getElementById('cardsTable');
    sealedProductsTable = document.getElementById('sealedProductsTable');
    categoriesTable = document.getElementById('categoriesTable');
    ordersTable = document.getElementById('ordersTable');
    adminCategoryFilter = document.getElementById('adminCategoryFilter');
    totalCardsCount = document.getElementById('totalCardsCount');
    uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');
    scannerModal = document.getElementById('scannerModal');
    openScannerBtn = document.getElementById('openScannerBtn');
    cameraStream = document.getElementById('cameraStream');
    captureCanvas = document.getElementById('captureCanvas');
    scannerStatusMessage = document.getElementById('scannerStatusMessage');

    openModal(loginModal);

    // Eventos Menú
    sidebarToggleBtn?.addEventListener('click', () => { sidebarMenu.classList.add('show'); sidebarOverlay.style.display = 'block'; });
    sidebarOverlay?.addEventListener('click', () => { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display = 'none'; });

    const navs = [{b:navDashboard, s:dashboardSection}, {b:navCards, s:cardsSection}, {b:navSealedProducts, s:sealedProductsSection}, {b:navCategories, s:categoriesSection}, {b:navOrders, s:ordersSection}];
    navs.forEach(n => n.b?.addEventListener('click', () => { 
        showSection(n.s); 
        if(window.innerWidth <= 768){ sidebarMenu.classList.remove('show'); sidebarOverlay.style.display = 'none'; }
    }));

    openScannerBtn?.addEventListener('click', () => { openModal(scannerModal); startCamera(); });
    loginForm?.addEventListener('submit', handleLogin);
    navLogout?.addEventListener('click', handleLogout);
    cardForm?.addEventListener('submit', handleSaveCard);
    addCardBtn?.addEventListener('click', () => { cardForm.reset(); cardId.value = ''; openModal(cardModal); });

    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(cardModal); closeModal(scannerModal); stopCamera();
    }));
});
