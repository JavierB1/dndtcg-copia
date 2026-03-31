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
let ocrWorker = null; // NUEVA VARIABLE PARA LA IA

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn;
let closeSidebarBtn; 
let sidebarMenu;
let sidebarOverlay;
let mainHeader;
let loginModal;
let loginForm;
let loginMessage;
let usernameInput;
let passwordInput;
let togglePasswordVisibilityBtn; 

let navDashboard;
let navCards;
let navSealedProducts;
let navCategories;
let navOrders;
let navLogout;

let dashboardSection;
let cardsSection;
let sealedProductsSection;
let categoriesSection;
let ordersSection; 

let addCardBtn;
let addSealedProductBtn;
let addCategoryBtn;

let cardModal;
let cardModalTitle;
let cardForm;
let cardId;
let cardName;
let cardCode; 
let cardExpansion;
let cardImage;
let cardPrice;
let cardStock;
let cardCategory;
let saveCardBtn;

let sealedProductModal;
let sealedProductModalTitle;
let sealedProductForm;
let sealedProductId;
let sealedProductName;
let sealedProductImage;
let sealedProductCategory;
let sealedProductPrice;
let sealedProductStock;
let saveSealedProductBtn;

let categoryModal;
let categoryModalTitle;
let categoryForm;
let categoryId;
let categoryName;
let saveCategoryBtn;

let confirmModal;
let confirmMessage;
let cancelDeleteBtn;
let confirmDeleteBtn;

let cardsTable;
let sealedProductsTable;
let categoriesTable;
let ordersTable; 

let adminSearchInput;
let adminCategoryFilter;
let adminPrevPageBtn;
let adminNextPageBtn;
let adminPageInfo;

let adminSealedSearchInput;
let adminSealedCategoryFilter;
let adminSealedPrevPageBtn;
let adminSealedNextPageBtn;
let adminSealedPageInfo;

let totalCardsCount;
let totalSealedProductsCount;
let outOfStockCount;
let uniqueCategoriesCount;

let messageModal;
let closeMessageModalBtn;
let messageModalTitle;
let messageModalText;
let okMessageModalBtn;

let orderDetailsModal;
let closeOrderDetailsModalBtn;
let orderDetailsContent;
let orderStatusSelect;
let updateOrderStatusBtn;

// REFERENCIAS DEL ESCÁNER DE CÁMARA
let scannerModal;
let openScannerBtn;
let closeScannerBtn;
let cameraStream;
let captureCanvas;
let scannerStatusMessage;
let mediaStream = null;
let scanTimeout = null;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
    if (sectionToShow) {
        sectionToShow.classList.add('active');
    }
}

function hideAllSections() {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
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
// FUNCIÓN DE CÁMARA Y ESCÁNER REAL (OBTENCIÓN DE URL OFICIAL)
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
    
    // Si el worker ya existe, no lo volvemos a crear (ESTO ARREGLA EL CONGELAMIENTO EN IPAD)
    if (!ocrWorker) {
        try {
            ocrWorker = await Tesseract.createWorker('eng');
        } catch (e) {
            console.error("Error iniciando IA:", e);
        }
    }
}

async function startCamera() {
    try {
        scannerStatusMessage.textContent = "Iniciando cámara y motor de IA...";
        
        // Iniciamos la cámara
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        cameraStream.srcObject = mediaStream;
        
        // Iniciamos el motor de IA de fondo
        await initTesseractAPI();
        
        startScanningProcess();
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        scannerStatusMessage.textContent = "Error: Por favor permite el acceso a la cámara en Safari.";
        scannerStatusMessage.style.color = "#ef4444";
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
    }
    // No destruimos ocrWorker aquí para que escaneos futuros sean rápidos
}

async function startScanningProcess() {
    // MENSAJE ACTUALIZADO PARA DAR MEJORES INSTRUCCIONES
    scannerStatusMessage.innerHTML = "<strong>NO LA ACERQUES DEMASIADO</strong><br><small>Mantenla a 15cm para que enfoque. El sistema hará zoom automático en el número.</small>";
    scannerStatusMessage.style.color = "#10b981";
    scanTimeout = setTimeout(processScannedFrame, 2000); // 2 segundos iniciales
}

async function processScannedFrame() {
    if (!mediaStream || !ocrWorker) return;

    try {
        scannerStatusMessage.innerHTML = "Analizando texto...";
        scannerStatusMessage.style.color = "#f59e0b";

        const context = captureCanvas.getContext('2d');
        
        // --- ZOOM DIGITAL Y FILTRO ---
        const videoWidth = cameraStream.videoWidth;
        const videoHeight = cameraStream.videoHeight;

        // Recortamos el 50% central de la imagen de la cámara
        const cropWidth = videoWidth * 0.5;
        const cropHeight = videoHeight * 0.5;
        const startX = (videoWidth - cropWidth) / 2;
        const startY = (videoHeight - cropHeight) / 2;

        // Ampliamos el recorte x2 para ayudar a la IA a leerlo (Zoom Digital)
        captureCanvas.width = cropWidth * 2;
        captureCanvas.height = cropHeight * 2;

        // Aplicamos un filtro de alto contraste y escala de grises para eliminar brillos holográficos
        context.filter = 'contrast(1.5) grayscale(1)';

        context.drawImage(
            cameraStream,
            startX, startY, cropWidth, cropHeight,        // Origen (Recorte)
            0, 0, captureCanvas.width, captureCanvas.height // Destino (Ampliación)
        );
        
        // Restauramos el filtro por precaución
        context.filter = 'none';
        // ------------------------------

        // USAMOS EL WORKER YA CREADO (Mucho más rápido)
        const result = await ocrWorker.recognize(captureCanvas);
        const text = result.data.text;
        
        console.log("IA vio el siguiente texto: ", text);

        // Buscamos el patrón Number/Total
        const numberMatch = text.match(/([a-zA-Z0-9]{1,4})\s*\/\s*(\d{1,3})/);

        if (numberMatch) {
            let cardNumber = numberMatch[1].replace(/^0+/, ''); // Limpiar ceros iniciales
            scannerStatusMessage.innerHTML = `¡Código detectado: <strong>${numberMatch[0]}</strong>!<br><small>Buscando en base de datos...</small>`;
            scannerStatusMessage.style.color = "#3b82f6";

            // CONEXIÓN A POKÉMON TCG API
            const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:${cardNumber}`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                fillFormWithAPIData(data.data[0], numberMatch[0]);
            } else {
                scannerStatusMessage.innerHTML = `No encontré el ${numberMatch[0]}.<br><small>Asegúrate de no tapar la letra (ej. SWSH01)</small>`;
                scannerStatusMessage.style.color = "#ef4444";
                scanTimeout = setTimeout(processScannedFrame, 2500);
            }
        } else {
            scannerStatusMessage.innerHTML = "Buscando código...<br><small>Centra el número (Ej: 152/162) bajo el láser.</small>";
            scannerStatusMessage.style.color = "#ef4444";
            scanTimeout = setTimeout(processScannedFrame, 1500); // Reintento más rápido
        }
    } catch (error) {
        console.error("Error en lectura:", error);
        scannerStatusMessage.textContent = "Error de lectura. Reintentando...";
        scanTimeout = setTimeout(processScannedFrame, 1500);
    }
}

function fillFormWithAPIData(card, originalCode) {
    stopCamera();
    closeModal(scannerModal);
    openModal(cardModal);
    cardModalTitle.textContent = 'Carta Identificada Automáticamente';

    // Rellenamos los campos
    cardName.value = card.name;
    cardCode.value = originalCode || card.number;
    cardExpansion.value = card.set.name;
    
    // EXTRACCIÓN DE URL (Usa la versión Large si existe, si no la Small)
    cardImage.value = card.images.large || card.images.small || '';

    // Autocalcular precio de mercado
    let marketPrice = 0;
    if (card.tcgplayer && card.tcgplayer.prices) {
        const p = card.tcgplayer.prices;
        const key = Object.keys(p)[0];
        marketPrice = p[key].market || 0;
    }
    cardPrice.value = parseFloat(marketPrice).toFixed(2);
    
    // Categoría predeterminada
    if(cardCategory.options.length === 0) cardCategory.appendChild(new Option('Pokémon TCG', 'Pokémon TCG'));
    cardCategory.value = 'Pokémon TCG';

    // Brillo de éxito
    [cardName, cardCode, cardExpansion, cardImage].forEach(f => {
        f.style.backgroundColor = '#ecfdf5';
        setTimeout(() => f.style.backgroundColor = '', 2000);
    });
}


// ==========================================================================
// FIREBASE AUTHENTICATION FUNCTIONS
// ==========================================================================
async function handleLogin(event) {
    event.preventDefault();
    // EL TRUCO PARA EL IPAD: .trim() quita los espacios en blanco invisibles
    const email = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    clearLoginError();

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (error) {
        console.error('Error detallado de Firebase Auth:', error);
        // Mostrar errores específicos para que sepas exactamente qué bloquea Safari
        let errorMessage = 'Error al iniciar sesión. Revisa tus credenciales.';
        
        if (error.code === 'auth/invalid-email') {
            errorMessage = 'El formato del correo electrónico no es válido.';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Correo electrónico o contraseña incorrectos.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Error de red o Safari está bloqueando la conexión (Cookies).';
        } else {
            errorMessage = `Safari reporta: ${error.message}`;
        }
        
        showLoginError(errorMessage);
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
        showMessageModal("Error", 'No se pudo cerrar sesión.');
    }
}

onAuthStateChanged(auth, (user) => {
    currentAdminUser = user;
    userId = user ? user.uid : null;
});

// ==========================================================================
// DATA LOADING FUNCTIONS
// ==========================================================================
async function loadOrdersData() {
    if (!db) return;
    try {
        const ordersCol = collection(db, `artifacts/${appId}/public/data/orders`);
        const ordersSnapshot = await getDocs(ordersCol);
        allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderOrdersTable();
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
    }
}

async function loadCategories() {
    if (!db) return;
    try {
        const categoriesCol = collection(db, `artifacts/${appId}/public/data/categories`);
        const categorySnapshot = await getDocs(categoriesCol);
        allCategories = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateCategoryFiltersAndSelects();
        renderCategoriesTable();
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

async function loadCardsData() {
    if (!db) return;
    try {
        const cardsCol = collection(db, `artifacts/${appId}/public/data/cards`);
        const cardsSnapshot = await getDocs(cardsCol);
        allCards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCards = allCards.map(card => ({
            ...card,
            precio: parseFloat(card.precio) || 0,
            stock: parseInt(card.stock) || 0,
            codigo: card.codigo || '',
            expansion: card.expansion || ''
        }));
        renderCardsTable();
        updateDashboardStats();
    } catch (error) {
        console.error('Error al cargar datos de cartas:', error);
    }
}

async function loadSealedProductsData() {
    if (!db) return;
    try {
        const sealedProductsCol = collection(db, `artifacts/${appId}/public/data/sealed_products`);
        const sealedProductsSnapshot = await getDocs(sealedProductsCol);
        allSealedProducts = sealedProductsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allSealedProducts = allSealedProducts.map(product => ({
            ...product,
            precio: parseFloat(product.precio) || 0,
            stock: parseInt(product.stock) || 0
        }));
        renderSealedProductsTable();
        updateDashboardStats();
    } catch (error) {
        console.error('Error al cargar datos de productos sellados:', error);
    }
}

async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    await loadSealedProductsData();
    await loadOrdersData();
}

function populateCategoryFiltersAndSelects() {
    if (!adminCategoryFilter || !adminSealedCategoryFilter || !cardCategory || !sealedProductCategory) return;
    const categoryNames = allCategories.map(cat => cat.name);

    adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    adminSealedCategoryFilter.innerHTML = '<option value="">Todos los tipos</option>';
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona un Juego</option>';
    sealedProductCategory.innerHTML = '<option value="" disabled selected>Selecciona un tipo</option>';

    categoryNames.forEach(category => {
        adminCategoryFilter.appendChild(new Option(category, category));
        adminSealedCategoryFilter.appendChild(new Option(category, category));
        cardCategory.appendChild(new Option(category, category));
        sealedProductCategory.appendChild(new Option(category, category));
    });
}

// ==========================================================================
// TABLE RENDERING FUNCTIONS
// ==========================================================================
function renderOrdersTable() {
    if (!ordersTable) return;
    const tbody = ordersTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    allOrders.forEach(order => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${new Date(order.timestamp).toLocaleString()}</td>
            <td>${order.customerName}</td>
            <td>$${parseFloat(order.total).toFixed(2)}</td>
            <td>${order.status}</td>
            <td class="action-buttons">
                <button class="edit-button view-order-details-btn" data-id="${order.id}">Ver Detalles</button>
            </td>
        `;
    });
}

function renderCardsTable() {
    if (!cardsTable) return;
    const searchQuery = adminSearchInput.value.toLowerCase();
    const categoryFilter = adminCategoryFilter.value;

    const filteredCards = allCards.filter(card => {
        const matchesSearch = card.nombre?.toLowerCase().includes(searchQuery) || 
                              card.codigo?.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === "" || card.categoria === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
    const startIndex = (currentCardsPage - 1) * itemsPerPage;
    const cardsOnPage = filteredCards.slice(startIndex, startIndex + itemsPerPage);

    const tbody = cardsTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        cardsOnPage.forEach(card => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${card.id}</td>
                <td><img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'"></td>
                <td><strong>${card.nombre}</strong></td>
                <td><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${card.codigo}</span></td>
                <td>${card.expansion || ''}</td>
                <td>$${card.precio.toFixed(2)}</td>
                <td>${card.stock}</td>
                <td>${card.categoria}</td>
                <td class="action-buttons">
                    <button class="action-btn edit edit-card-btn" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete delete-card-btn" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }

    if (adminPageInfo) adminPageInfo.textContent = `Página ${currentCardsPage} de ${totalPages || 1}`;
}

function renderSealedProductsTable() {
    if (!sealedProductsTable) return;
    const tbody = sealedProductsTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        allSealedProducts.forEach(product => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.id}</td>
                <td><img src="${product.imagen_url}" alt="${product.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'"></td>
                <td><strong>${product.nombre}</strong></td>
                <td>${product.categoria}</td>
                <td>$${product.precio.toFixed(2)}</td>
                <td>${product.stock}</td>
                <td class="action-buttons">
                    <button class="action-btn edit edit-sealed-product-button" data-id="${product.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete delete-sealed-product-button" data-id="${product.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }
}

function renderCategoriesTable() {
    if (!categoriesTable) return;
    const tbody = categoriesTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        allCategories.forEach(category => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><strong>${category.name}</strong></td>
                <td class="action-buttons">
                    <button class="action-btn edit edit-category-button" data-id="${category.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete delete-category-button" data-id="${category.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }
}

function updateDashboardStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (totalSealedProductsCount) totalSealedProductsCount.textContent = allSealedProducts.length;
    if (outOfStockCount) outOfStockCount.textContent = allCards.filter(c => c.stock === 0).length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
}

// ==========================================================================
// CRUD OPERATIONS
// ==========================================================================

async function handleSaveCard(event) {
    event.preventDefault();
    const id = cardId.value;
    const data = {
        nombre: cardName.value,
        codigo: cardCode.value, 
        expansion: cardExpansion.value,
        imagen_url: cardImage.value,
        precio: parseFloat(cardPrice.value).toFixed(2),
        stock: parseInt(cardStock.value),
        categoria: cardCategory.value
    };

    try {
        if (id) {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/cards`, id), data);
        } else {
            await addDoc(collection(db, `artifacts/${appId}/public/data/cards`), data);
        }
        cardForm.reset();
        closeModal(cardModal);
        await loadCardsData();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleSaveSealedProduct(event) {
    event.preventDefault();
    const id = sealedProductId.value;
    const data = {
        nombre: sealedProductName.value,
        imagen_url: sealedProductImage.value,
        categoria: sealedProductCategory.value,
        precio: parseFloat(sealedProductPrice.value).toFixed(2),
        stock: parseInt(sealedProductStock.value)
    };

    try {
        if (id) {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/sealed_products`, id), data);
        } else {
            await addDoc(collection(db, `artifacts/${appId}/public/data/sealed_products`), data);
        }
        sealedProductForm.reset();
        closeModal(sealedProductModal);
        await loadSealedProductsData();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleSaveCategory(event) {
    event.preventDefault();
    const id = categoryId.value;
    try {
        if (id) {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/categories`, id), { name: categoryName.value });
        } else {
            await addDoc(collection(db, `artifacts/${appId}/public/data/categories`), { name: categoryName.value });
        }
        categoryForm.reset();
        closeModal(categoryModal);
        await loadCategories();
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleDeleteConfirmed() {
    const { type, id } = currentDeleteTarget;
    try {
        const path = type === 'card' ? 'cards' : (type === 'sealedProduct' ? 'sealed_products' : 'categories');
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/${path}`, id));
        closeModal(confirmModal);
        if(type === 'card') await loadCardsData();
        if(type === 'sealedProduct') await loadSealedProductsData();
        if(type === 'category') { await loadCategories(); await loadCardsData(); }
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // INYECCIÓN DE ESTILOS MÓVILES
    const mobileStyles = document.createElement('style');
    mobileStyles.innerHTML = `
        @media (max-width: 768px) {
            .sidebar { position: fixed; left: -260px; height: 100%; z-index: 50; transition: left 0.3s ease; }
            .sidebar.show { left: 0; }
            .sidebar-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 45; }
            .main-content { width: 100%; margin-left: 0; }
            .sidebar-toggle-btn { display: block !important; margin-right: 15px; }
            .action-btn { padding: 12px; margin-right: 5px; }
            .admin-modal-content { width: 95%; max-height: 90vh; overflow-y: auto; }
        }
    `;
    document.head.appendChild(mobileStyles);

    // ASIGNACIÓN DOM
    sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    closeSidebarBtn = document.getElementById('closeSidebarBtn');
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    loginMessage = document.getElementById('loginMessage');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    togglePasswordVisibilityBtn = document.getElementById('togglePasswordVisibilityBtn');

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
    addSealedProductBtn = document.getElementById('addSealedProductBtn');
    addCategoryBtn = document.getElementById('addCategoryBtn');

    cardModal = document.getElementById('cardModal');
    cardModalTitle = document.getElementById('cardModalTitle');
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardCode = document.getElementById('cardCode'); 
    cardExpansion = document.getElementById('cardExpansion'); 
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');

    sealedProductModal = document.getElementById('sealedProductModal');
    sealedProductModalTitle = document.getElementById('sealedProductModalTitle');
    sealedProductForm = document.getElementById('sealedProductForm');
    sealedProductId = document.getElementById('sealedProductId');
    sealedProductName = document.getElementById('sealedProductName');
    sealedProductImage = document.getElementById('sealedProductImage');
    sealedProductCategory = document.getElementById('sealedProductCategory');
    sealedProductPrice = document.getElementById('sealedProductPrice');
    sealedProductStock = document.getElementById('sealedProductStock');

    categoryModal = document.getElementById('categoryModal');
    categoryModalTitle = document.getElementById('categoryModalTitle');
    categoryForm = document.getElementById('categoryForm');
    categoryId = document.getElementById('categoryId');
    categoryName = document.getElementById('categoryName');

    confirmModal = document.getElementById('confirmModal');
    confirmMessage = document.getElementById('confirmMessage');
    cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    cardsTable = document.getElementById('cardsTable');
    sealedProductsTable = document.getElementById('sealedProductsTable');
    categoriesTable = document.getElementById('categoriesTable');
    ordersTable = document.getElementById('ordersTable'); 

    adminSearchInput = document.getElementById('adminSearchInput');
    adminCategoryFilter = document.getElementById('adminCategoryFilter');
    adminPrevPageBtn = document.getElementById('adminPrevPageBtn');
    adminNextPageBtn = document.getElementById('adminNextPageBtn');
    adminPageInfo = document.getElementById('adminPageInfo');

    totalCardsCount = document.getElementById('totalCardsCount');
    totalSealedProductsCount = document.getElementById('totalSealedProductsCount');
    outOfStockCount = document.getElementById('outOfStockCount');
    uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');

    scannerModal = document.getElementById('scannerModal');
    openScannerBtn = document.getElementById('openScannerBtn');
    closeScannerBtn = document.getElementById('closeScannerBtn');
    cameraStream = document.getElementById('cameraStream');
    captureCanvas = document.getElementById('captureCanvas');
    scannerStatusMessage = document.getElementById('scannerStatusMessage');

    openModal(loginModal);

    // EVENTOS BÁSICOS
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', () => { sidebarMenu.classList.add('show'); sidebarOverlay.style.display = 'block'; });
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display = 'none'; });
    
    if (openScannerBtn) {
        openScannerBtn.addEventListener('click', () => {
            openModal(scannerModal);
            startCamera();
        });
    }

    if (cardForm) cardForm.addEventListener('submit', handleSaveCard);
    if (sealedProductForm) sealedProductForm.addEventListener('submit', handleSaveSealedProduct);
    if (categoryForm) categoryForm.addEventListener('submit', handleSaveCategory);

    // Navegación de secciones
    const navs = [{btn: navDashboard, sec: dashboardSection}, {btn: navCards, sec: cardsSection}, {btn: navSealedProducts, sec: sealedProductsSection}, {btn: navCategories, sec: categoriesSection}, {btn: navOrders, sec: ordersSection}];
    navs.forEach(nav => {
        if(nav.btn) nav.btn.addEventListener('click', () => {
            showSection(nav.sec);
            if (window.innerWidth <= 768) { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display = 'none'; }
        });
    });

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (navLogout) navLogout.addEventListener('click', handleLogout);
    
    // Cierre de modales
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-modal').forEach(m => closeModal(m));
            stopCamera();
        });
    });

    // Paginación
    if (adminPrevPageBtn) adminPrevPageBtn.addEventListener('click', () => { if (currentCardsPage > 1) { currentCardsPage--; renderCardsTable(); } });
    if (adminNextPageBtn) adminNextPageBtn.addEventListener('click', () => { currentCardsPage++; renderCardsTable(); });
});
