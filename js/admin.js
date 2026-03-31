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
// FUNCIÓN DE CÁMARA Y ESCÁNER EN VIVO (CONEXIÓN POKÉMON TCG REAL)
// ==========================================================================

// Función para cargar la Inteligencia Artificial de lectura de texto
function loadTesseractAPI() {
    return new Promise((resolve) => {
        if (window.Tesseract) {
            resolve();
        } else {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        }
    });
}

async function startCamera() {
    try {
        scannerStatusMessage.textContent = "Solicitando permisos de cámara...";
        scannerStatusMessage.style.color = "#3b82f6";
        
        // FORZAMOS LA CÁMARA A ALTA RESOLUCIÓN Y AUTOENFOQUE
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                advanced: [{ focusMode: "continuous" }] 
            }
        });
        
        cameraStream.srcObject = mediaStream;
        
        // Iniciar proceso de lectura de inmediato
        startScanningProcess();
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        scannerStatusMessage.textContent = "Error: Por favor permite el acceso a la cámara y verifica la resolución.";
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
}

async function startScanningProcess() {
    scannerStatusMessage.textContent = "Cargando motor de Inteligencia Artificial...";
    scannerStatusMessage.style.color = "#3b82f6";
    
    await loadTesseractAPI();
    
    scannerStatusMessage.textContent = "Enfoca bien el CÓDIGO de abajo (Ej: 025/165).";
    scannerStatusMessage.style.color = "#10b981";
    
    // Inicia un bucle que toma una foto cada 3 segundos hasta encontrar algo
    scanTimeout = setTimeout(processScannedFrame, 3000);
}

async function processScannedFrame() {
    if (!mediaStream) return; // Si la cámara se apagó, detenemos el proceso

    try {
        scannerStatusMessage.textContent = "Analizando texto de la carta...";
        scannerStatusMessage.style.color = "#f59e0b"; // Naranja

        // Tomamos una "foto" invisible del video
        const context = captureCanvas.getContext('2d');
        captureCanvas.width = cameraStream.videoWidth;
        captureCanvas.height = cameraStream.videoHeight;
        context.drawImage(cameraStream, 0, 0, captureCanvas.width, captureCanvas.height);

        // Usamos la IA para leer el texto de esa foto
        const result = await Tesseract.recognize(captureCanvas, 'eng');
        const text = result.data.text;

        // --- IMPRIMIR EN CONSOLA PARA DEPURACIÓN ---
        console.log("------- NUEVO INTENTO DE ESCANEO -------");
        console.log("Texto que logró leer la cámara:\n", text);
        console.log("----------------------------------------");

        // Buscamos un patrón típico de Pokémon, permitiendo posibles espacios accidentales de la lectura
        const numberMatch = text.match(/([a-zA-Z0-9]{1,4})\s*\/\s*(\d{1,3})/);

        if (numberMatch) {
            let cardNumber = numberMatch[1];
            // Removemos ceros a la izquierda (ej. 025 se vuelve 25) porque la API oficial los usa así
            cardNumber = cardNumber.replace(/^0+/, '');

            scannerStatusMessage.textContent = `¡Código detectado: ${numberMatch[0]}! Descargando datos...`;
            scannerStatusMessage.style.color = "#10b981";

            // CONEXIÓN A LA API REAL DE POKÉMON TCG
            console.log(`Buscando en API Pokémon: número ${cardNumber}`);
            const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:${cardNumber}`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // Si encontramos la carta, autocompletamos
                console.log("Carta encontrada en API:", data.data[0]);
                fillFormWithAPIData(data.data[0], numberMatch[0]);
            } else {
                scannerStatusMessage.textContent = `Código ${numberMatch[0]} no encontrado. Intentando de nuevo...`;
                scannerStatusMessage.style.color = "#ef4444";
                scanTimeout = setTimeout(processScannedFrame, 3000);
            }
        } else {
            // Si la IA no logró leer el texto
            scannerStatusMessage.textContent = "No detecto el código. Ilumina bien la parte de abajo de la carta.";
            scannerStatusMessage.style.color = "#ef4444";
            scanTimeout = setTimeout(processScannedFrame, 3000);
        }
    } catch (error) {
        console.error("Error al leer la carta:", error);
        scannerStatusMessage.textContent = "Error al procesar. Reintentando...";
        scanTimeout = setTimeout(processScannedFrame, 3000);
    }
}

// Función que toma los datos de la API de Pokémon y los pega en tu formulario
function fillFormWithAPIData(card, originalCode) {
    stopCamera();
    closeModal(scannerModal);
    openModal(cardModal);
    cardModalTitle.textContent = 'Carta Encontrada Automáticamente';

    // Rellenamos los datos reales
    cardName.value = card.name;
    cardCode.value = originalCode || card.number;
    cardExpansion.value = card.set.name;

    // Buscamos el precio en la base de datos (Cardmarket o TCGPlayer)
    let price = 0;
    if (card.cardmarket && card.cardmarket.prices && card.cardmarket.prices.averageSellPrice) {
        price = card.cardmarket.prices.averageSellPrice;
    } else if (card.tcgplayer && card.tcgplayer.prices) {
        const priceKeys = Object.keys(card.tcgplayer.prices);
        if (priceKeys.length > 0) {
            price = card.tcgplayer.prices[priceKeys[0]].market || 0;
        }
    }
    cardPrice.value = parseFloat(price).toFixed(2);
    
    // Rellenamos la foto oficial
    cardImage.value = card.images.small || '';

    // Rellenamos la categoría a "Pokémon TCG"
    if(cardCategory.options.length === 0) {
        cardCategory.appendChild(new Option('Pokémon TCG', 'Pokémon TCG'));
    } else {
        let exists = Array.from(cardCategory.options).some(opt => opt.value === 'Pokémon TCG');
        if(!exists) cardCategory.appendChild(new Option('Pokémon TCG', 'Pokémon TCG'));
    }
    cardCategory.value = 'Pokémon TCG';

    // Hacemos que brillen en verde un segundo para que veas qué se llenó
    const fields = [cardName, cardCode, cardExpansion, cardPrice];
    fields.forEach(f => f.style.backgroundColor = '#ecfdf5');
    setTimeout(() => fields.forEach(f => f.style.backgroundColor = ''), 2000);
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
        console.log('Administrador ha iniciado sesión con Firebase Auth.');
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (error) {
        console.error('Error al iniciar sesión con Firebase:', error);
        let errorMessage = 'Error al iniciar sesión. Por favor, inténtalo de nuevo.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Correo electrónico o contraseña incorrectos. Por favor, verifica tus credenciales.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Formato de correo electrónico no válido.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Error de red. Verifica tu conexión a internet.';
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
        showMessageModal("Error al cerrar sesión", 'Error al cerrar sesión. Por favor, inténtalo de nuevo.');
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
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona una categoría (Juego)</option>';
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

    if (allOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay pedidos para mostrar.</td></tr>';
        return;
    }

    allOrders.forEach(order => {
        const orderDate = new Date(order.timestamp).toLocaleString('es-SV');
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${orderDate}</td>
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
                              card.id?.toLowerCase().includes(searchQuery) ||
                              card.codigo?.toLowerCase().includes(searchQuery);
                              
        const matchesCategory = categoryFilter === "" || card.categoria === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
    currentCardsPage = Math.min(Math.max(currentCardsPage, 1), totalPages || 1);
    const startIndex = (currentCardsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const cardsOnPage = filteredCards.slice(startIndex, endIndex);

    const tbody = cardsTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        cardsOnPage.forEach(card => {
            const row = tbody.insertRow();
            const badgeCode = card.codigo ? `<span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; font-family: monospace; color: #475569; border: 1px solid #cbd5e1;">${card.codigo}</span>` : '<span style="color:#a0aec0; font-size: 0.85rem;">N/A</span>';
            
            row.innerHTML = `
                <td>${card.id}</td>
                <td><img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'"></td>
                <td><strong>${card.nombre}</strong></td>
                <td>${badgeCode}</td>
                <td>${card.expansion || ''}</td>
                <td>$${card.precio.toFixed(2)}</td>
                <td>${card.stock}</td>
                <td>${card.categoria}</td>
                <td class="action-buttons">
                    <button class="action-btn edit edit-card-btn" data-id="${card.id}"><i class="fas fa-edit" data-id="${card.id}"></i></button>
                    <button class="action-btn delete delete-card-btn" data-id="${card.id}"><i class="fas fa-trash" data-id="${card.id}"></i></button>
                </td>
            `;
        });
    }

    if (adminPageInfo) adminPageInfo.textContent = `Página ${currentCardsPage} de ${totalPages || 1}`;
    if (adminPrevPageBtn) adminPrevPageBtn.disabled = currentCardsPage <= 1;
    if (adminNextPageBtn) adminNextPageBtn.disabled = currentCardsPage >= totalPages;
}

function renderSealedProductsTable() {
    if (!sealedProductsTable) return;
    const searchQuery = adminSealedSearchInput.value.toLowerCase();
    const categoryFilter = adminSealedCategoryFilter.value;

    const filteredSealedProducts = allSealedProducts.filter(product => {
        const matchesSearch = product.nombre?.toLowerCase().includes(searchQuery) || product.id?.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === "" || product.categoria === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filteredSealedProducts.length / itemsPerPage);
    currentSealedProductsPage = Math.min(Math.max(currentSealedProductsPage, 1), totalPages || 1);
    const startIndex = (currentSealedProductsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const productsOnPage = filteredSealedProducts.slice(startIndex, endIndex);

    const tbody = sealedProductsTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        productsOnPage.forEach(product => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.id}</td>
                <td><img src="${product.imagen_url}" alt="${product.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'"></td>
                <td><strong>${product.nombre}</strong></td>
                <td>${product.categoria}</td>
                <td>$${product.precio.toFixed(2)}</td>
                <td>${product.stock}</td>
                <td class="action-buttons">
                    <button class="action-btn edit edit-sealed-product-button" data-id="${product.id}"><i class="fas fa-edit" data-id="${product.id}"></i></button>
                    <button class="action-btn delete delete-sealed-product-button" data-id="${product.id}"><i class="fas fa-trash" data-id="${product.id}"></i></button>
                </td>
            `;
        });
    }

    if (adminSealedPageInfo) adminSealedPageInfo.textContent = `Página ${currentSealedProductsPage} de ${totalPages || 1}`;
    if (adminSealedPrevPageBtn) adminSealedPrevPageBtn.disabled = currentSealedProductsPage <= 1;
    if (adminSealedNextPageBtn) adminSealedNextPageBtn.disabled = currentSealedProductsPage >= totalPages;
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
                    <button class="action-btn edit edit-category-button" data-id="${category.id}"><i class="fas fa-edit" data-id="${category.id}"></i></button>
                    <button class="action-btn delete delete-category-button" data-id="${category.id}"><i class="fas fa-trash" data-id="${category.id}"></i></button>
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
function showOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    let itemsHtml = '';
    const cart = JSON.parse(order.cart);
    for (const itemId in cart) {
        const item = cart[itemId];
        let productData = item.type === 'card' ? allCards.find(c => c.id === itemId) : allSealedProducts.find(p => p.id === itemId);

        if (productData) {
            itemsHtml += `
                <div class="order-item">
                    <img src="${productData.imagen_url}" alt="${productData.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'" style="width: 40px; height: 40px; border-radius: 4px;">
                    <div class="order-item-info" style="display:inline-block; margin-left: 10px; vertical-align: top;">
                        <strong>${productData.nombre} ${productData.codigo ? `(${productData.codigo})` : ''}</strong><br>
                        <span>Cant: ${item.quantity}</span> |
                        <span>Precio: $${parseFloat(productData.precio).toFixed(2)}</span>
                    </div>
                </div>
                <hr style="border:0; border-top:1px solid #e2e8f0; margin: 10px 0;">
            `;
        }
    }

    orderDetailsContent.innerHTML = `
        <div class="customer-details" style="background:#f8fafc; padding: 15px; border-radius:8px; margin-bottom:15px;">
            <h4>Datos del Cliente</h4>
            <p><strong>Nombre:</strong> ${order.customerName}</p>
            <p><strong>Teléfono:</strong> ${order.customerPhone}</p>
            <p><strong>Dirección:</strong> ${order.customerAddress}</p>
        </div>
        <div class="order-items">
            <h4>Productos</h4>
            <div class="order-items-list" style="max-height: 250px; overflow-y: auto; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;">${itemsHtml}</div>
        </div>
        <div class="order-summary" style="margin-top: 15px; text-align: right; font-size: 1.2rem;">
            <p><strong>Total:</strong> <span style="color:#10b981;">$${parseFloat(order.total).toFixed(2)}</span></p>
        </div>
    `;

    orderStatusSelect.value = order.status;
    updateOrderStatusBtn.dataset.orderId = orderId;
    openModal(orderDetailsModal);
}

async function handleUpdateOrderStatus() {
    const orderId = updateOrderStatusBtn.dataset.orderId;
    const newStatus = orderStatusSelect.value;
    const orderToUpdate = allOrders.find(o => o.id === orderId);
    if (!orderToUpdate || orderToUpdate.status === newStatus) return closeModal(orderDetailsModal);

    try {
        await runTransaction(db, async (transaction) => {
            const orderDocRef = doc(db, `artifacts/${appId}/public/data/orders`, orderId);
            if (newStatus === 'cancelled' && orderToUpdate.status !== 'cancelled') {
                const cart = JSON.parse(orderToUpdate.cart);
                for (const itemId in cart) {
                    const cartItem = cart[itemId];
                    const colName = cartItem.type === 'card' ? 'cards' : 'sealed_products';
                    const itemRef = doc(db, `artifacts/${appId}/public/data/${colName}`, itemId);
                    const itemDoc = await transaction.get(itemRef);
                    if (itemDoc.exists()) {
                        transaction.update(itemRef, { stock: itemDoc.data().stock + cartItem.quantity });
                    }
                }
            }
            transaction.update(orderDocRef, { status: newStatus });
        });
        showMessageModal("Éxito", "Estado del pedido actualizado.");
        closeModal(orderDetailsModal);
        await loadAllData();
    } catch (error) {
        showMessageModal("Error", "No se pudo actualizar el estado.");
    }
}

async function handleSaveCard(event) {
    event.preventDefault();
    const id = cardId.value;
    
    // GUARDA EL CÓDIGO Y LA EXPANSIÓN
    const data = {
        nombre: cardName.value,
        codigo: cardCode.value, 
        expansion: cardExpansion.value,
        imagen_url: cardImage.value || '',
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
        imagen_url: sealedProductImage.value || '',
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
// EVENT LISTENERS Y CONFIGURACIÓN INICIAL
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // INYECCIÓN DE ESTILOS MÓVILES
    const mobileStyles = document.createElement('style');
    mobileStyles.innerHTML = `
        @media (max-width: 768px) {
            .sidebar { position: fixed; left: -260px; height: 100%; z-index: 50; transition: left 0.3s ease; }
            .sidebar.show { left: 0; }
            .sidebar-
