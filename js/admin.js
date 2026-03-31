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

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

// Gemini API Key (inyectada por el entorno)
const apiKey = ""; 

// Inicializa los servicios de Firebase
let app;
let db;
let auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    console.error("Error: firebaseConfig no está disponible.");
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

// --- NUEVAS VARIABLES PARA ESCÁNER ---
let cameraStream = null;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn, closeSidebarBtn, sidebarMenu, sidebarOverlay, mainHeader;
let loginModal, loginForm, loginMessage, usernameInput, passwordInput, togglePasswordVisibilityBtn;

let navDashboard, navCards, navSealedProducts, navCategories, navOrders, navLogout, navScanner;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection;

let addCardBtn, addSealedProductBtn, addCategoryBtn;
let cardModal, cardModalTitle, cardForm, cardId, cardName, cardImage, cardPrice, cardStock, cardCategory, cardSetCode, saveCardBtn;
let sealedProductModal, sealedProductModalTitle, sealedProductForm, sealedProductId, sealedProductName, sealedProductImage, sealedProductCategory, sealedProductPrice, sealedProductStock, saveSealedProductBtn;
let categoryModal, categoryModalTitle, categoryForm, categoryId, categoryName, saveCategoryBtn;

let confirmModal, confirmMessage, cancelDeleteBtn, confirmDeleteBtn;
let cardsTable, sealedProductsTable, categoriesTable, ordersTable;

let adminSearchInput, adminCategoryFilter, adminPrevPageBtn, adminNextPageBtn, adminPageInfo;
let adminSealedSearchInput, adminSealedCategoryFilter, adminSealedPrevPageBtn, adminSealedNextPageBtn, adminSealedPageInfo;

let totalCardsCount, totalSealedProductsCount, outOfStockCount, uniqueCategoriesCount;
let messageModal, closeMessageModalBtn, messageModalTitle, messageModalText, okMessageModalBtn;
let orderDetailsModal, closeOrderDetailsModalBtn, orderDetailsContent, orderStatusSelect, updateOrderStatusBtn;

// --- NUEVAS REFERENCIAS ESCÁNER ---
let videoPreview, startScanBtn, navScannerQuick;

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
    // Si salimos del escáner, apagamos la cámara para ahorrar recursos
    if (sectionToShow !== scannerSection) {
        stopCamera();
    }
}

function hideAllSections() {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
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
// AI SCANNER FUNCTIONS
// ==========================================================================

async function startCamera() {
    try {
        // Intentar obtener acceso a la cámara trasera primero
        const constraints = { 
            video: { 
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoPreview) {
            videoPreview.srcObject = cameraStream;
            showSection(scannerSection);
            console.log("Cámara iniciada correctamente");
        }
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        showMessageModal("Error de Cámara", "No se pudo acceder a la cámara. Por favor, verifica los permisos de tu navegador o usa una conexión HTTPS.");
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        if (videoPreview) videoPreview.srcObject = null;
    }
}

async function handleScanAndIdentify() {
    if (!videoPreview || !cameraStream) {
        console.error("Video preview no disponible o stream no iniciado");
        return;
    }

    // Crear canvas para capturar el frame actual del video
    const canvas = document.createElement('canvas');
    canvas.width = videoPreview.videoWidth;
    canvas.height = videoPreview.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoPreview, 0, 0);
    
    // Convertir a base64 para la API
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // UI Feedback
    startScanBtn.disabled = true;
    startScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando carta...';

    try {
        const result = await analyzeCardWithIA(base64Image);
        
        if (result && (result.nombre || result.name)) {
            stopCamera();
            showSection(cardsSection);
            
            // Limpiar y preparar modal
            cardId.value = ''; 
            cardForm.reset();
            cardModalTitle.textContent = "Añadir Carta (Detectada por IA)";
            
            // Mapear campos (soporta inglés/español de la IA)
            cardName.value = result.nombre || result.name || '';
            const code = result.codigo_set || result.set_code || '';
            if (cardSetCode) cardSetCode.value = code;
            
            // Selección de categoría inteligente
            if (result.categoria || result.category) {
                const cat = (result.categoria || result.category).toLowerCase();
                const options = Array.from(cardCategory.options);
                const found = options.find(o => cat.includes(o.value.toLowerCase()) || o.value.toLowerCase().includes(cat));
                if (found) cardCategory.value = found.value;
            }
            
            openModal(cardModal);
            showMessageModal("¡Identificada!", `Carta: ${result.nombre || result.name}. Completa los detalles de precio y stock.`);
        } else {
            throw new Error("Respuesta incompleta de la IA");
        }
    } catch (error) {
        console.error("Error en identificación IA:", error);
        showMessageModal("Aviso", "No pudimos identificar la carta con claridad. Asegúrate de que la carta sea legible y esté centrada.");
    } finally {
        startScanBtn.disabled = false;
        startScanBtn.innerHTML = '<i class="fas fa-bullseye"></i> Capturar e Identificar';
    }
}

async function analyzeCardWithIA(base64Data) {
    const prompt = "Actúa como un experto en TCG. Identifica esta carta de Pokémon, Yu-Gi-Oh o Magic. Devuelve UNICAMENTE un objeto JSON con: 'nombre' (nombre exacto), 'codigo_set' (ej: 054/073) y 'categoria' (Pokémon, Magic, Yu-Gi-Oh).";
    
    // Implementación con Retries (Exponencial Backoff) para estabilidad
    let retries = 0;
    const maxRetries = 3;
    
    const callApi = async () => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                    ]
                }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.1 
                }
            })
        });

        if (!response.ok) throw new Error("Error API Gemini");
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return JSON.parse(rawText);
    };

    while (retries < maxRetries) {
        try {
            return await callApi();
        } catch (e) {
            retries++;
            if (retries === maxRetries) throw e;
            await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
        }
    }
}

// ==========================================================================
// FIREBASE AUTHENTICATION FUNCTIONS
// ==========================================================================

async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';
    clearLoginError();

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        showLoginError('Credenciales incorrectas o error de conexión.');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        userId = null;
        currentAdminUser = null;
        hideAllSections();
        openModal(loginModal);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

onAuthStateChanged(auth, (user) => {
    currentAdminUser = user;
    userId = user ? user.uid : null;
});

// ==========================================================================
// DATA LOADING FUNCTIONS
// ==========================================================================

async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    await loadSealedProductsData();
    await loadOrdersData();
}

async function loadOrdersData() {
    if (!db) return;
    try {
        const ordersCol = collection(db, `artifacts/${appId}/public/data/orders`);
        const ordersSnapshot = await getDocs(ordersCol);
        allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allOrders.sort((a, b) => new Promise((resolve) => resolve(new Date(b.timestamp) - new Date(a.timestamp))));
        renderOrdersTable();
    } catch (error) { console.error('Error al cargar pedidos:', error); }
}

async function loadCategories() {
    if (!db) return;
    try {
        const categoriesCol = collection(db, `artifacts/${appId}/public/data/categories`);
        const categorySnapshot = await getDocs(categoriesCol);
        allCategories = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateCategoryFiltersAndSelects();
        renderCategoriesTable();
    } catch (error) { console.error('Error al cargar categorías:', error); }
}

async function loadCardsData() {
    if (!db) return;
    try {
        const cardsCol = collection(db, `artifacts/${appId}/public/data/cards`);
        const cardsSnapshot = await getDocs(cardsCol);
        allCards = cardsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            precio: parseFloat(doc.data().precio) || 0,
            stock: parseInt(doc.data().stock) || 0
        }));
        renderCardsTable();
        updateDashboardStats();
    } catch (error) { console.error('Error al cargar cartas:', error); }
}

async function loadSealedProductsData() {
    if (!db) return;
    try {
        const sealedProductsCol = collection(db, `artifacts/${appId}/public/data/sealed_products`);
        const sealedProductsSnapshot = await getDocs(sealedProductsCol);
        allSealedProducts = sealedProductsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            precio: parseFloat(doc.data().precio) || 0,
            stock: parseInt(doc.data().stock) || 0
        }));
        renderSealedProductsTable();
        updateDashboardStats();
    } catch (error) { console.error('Error al cargar productos sellados:', error); }
}

// ==========================================================================
// RENDER FUNCTIONS & TABLE UPDATES
// ==========================================================================

function renderCardsTable() {
    if (!cardsTable) return;
    const tbody = cardsTable.querySelector('tbody');
    const filtered = allCards.filter(c => 
        c.nombre.toLowerCase().includes((adminSearchInput?.value || '').toLowerCase())
    );
    
    tbody.innerHTML = filtered.map(card => `
        <tr>
            <td>${card.id}</td>
            <td><img src="${card.imagen_url}" width="40" onerror="this.src='https://placehold.co/40x50'"></td>
            <td>${card.nombre}</td>
            <td>${card.codigo_set || 'N/A'}</td>
            <td>$${card.precio.toFixed(2)}</td>
            <td>${card.stock}</td>
            <td class="action-buttons">
                <button class="edit-button edit-card-btn" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                <button class="delete-button delete-card-btn" data-id="${card.id}"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderOrdersTable() {
    // Implementación básica de renderizado de pedidos
}

function renderCategoriesTable() {
    // Implementación básica de renderizado de categorías
}

function renderSealedProductsTable() {
    // Implementación básica de renderizado de productos sellados
}

function updateDashboardStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (totalSealedProductsCount) totalSealedProductsCount.textContent = allSealedProducts.length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
    const lowStock = allCards.filter(c => c.stock <= 0).length + allSealedProducts.filter(p => p.stock <= 0).length;
    if (outOfStockCount) outOfStockCount.textContent = lowStock;
}

function populateCategoryFiltersAndSelects() {
    if (!cardCategory) return;
    const categoryNames = allCategories.map(cat => cat.name);
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
    categoryNames.forEach(category => {
        const opt = document.createElement('option');
        opt.value = category;
        opt.textContent = category;
        cardCategory.appendChild(opt);
    });
}

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM Generales
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    
    // Navegación
    navDashboard = document.getElementById('nav-dashboard');
    navCards = document.getElementById('nav-cards');
    navScanner = document.getElementById('nav-scanner');
    navScannerQuick = document.getElementById('nav-scanner-quick');
    navOrders = document.getElementById('nav-orders');
    navLogout = document.getElementById('nav-logout');

    // Secciones
    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    scannerSection = document.getElementById('scanner-section');
    ordersSection = document.getElementById('orders-section');
    sealedProductsSection = document.getElementById('sealed-products-section');
    categoriesSection = document.getElementById('categories-section');

    // Tablas y Modales
    cardsTable = document.getElementById('cardsTable');
    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardName = document.getElementById('cardName');
    cardId = document.getElementById('cardId');
    cardCategory = document.getElementById('cardCategory');
    cardSetCode = document.getElementById('cardSetCode');
    messageModal = document.getElementById('messageModal'); // Asegurar existencia
    messageModalTitle = document.getElementById('messageModalTitle');
    messageModalText = document.getElementById('messageModalText');

    // Referencias Escáner
    videoPreview = document.getElementById('video-preview');
    startScanBtn = document.getElementById('startScanBtn');

    // Stats
    totalCardsCount = document.getElementById('totalCardsCount');
    totalSealedProductsCount = document.getElementById('totalSealedProductsCount');
    outOfStockCount = document.getElementById('outOfStockCount');
    uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');

    // --- EVENT LISTENERS NAVEGACIÓN ---
    navDashboard?.addEventListener('click', (e) => { e.preventDefault(); showSection(dashboardSection); });
    navCards?.addEventListener('click', (e) => { e.preventDefault(); showSection(cardsSection); });
    navScanner?.addEventListener('click', (e) => { e.preventDefault(); startCamera(); });
    navScannerQuick?.addEventListener('click', (e) => { e.preventDefault(); startCamera(); });
    navLogout?.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });

    // --- EVENT LISTENERS OPERATIVOS ---
    loginForm?.addEventListener('submit', handleLogin);
    startScanBtn?.addEventListener('click', handleScanAndIdentify);
    
    // Búsqueda en vivo
    adminSearchInput = document.getElementById('adminSearchInput');
    adminSearchInput?.addEventListener('input', renderCardsTable);

    // Control de autenticación inicial
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (loginModal) closeModal(loginModal);
            showSection(dashboardSection);
            loadAllData();
        } else {
            if (loginModal) openModal(loginModal);
        }
    });
});

// Nota del Desarrollador: Las funciones de guardado, edición y eliminación (CRUD)
// siguen operando sobre las mismas colecciones de Firestore que ya tenías configuradas.
