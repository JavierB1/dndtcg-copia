// Pega tu código JavaScript aquí// ==========================================================================
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
// FUNCIÓN DE CÁMARA Y ESCÁNER EN VIVO
// ==========================================================================

async function startCamera() {
    try {
        scannerStatusMessage.textContent = "Solicitando permisos de cámara...";
        scannerStatusMessage.style.color = "#3b82f6";
        
        // Pide acceso a la cámara. En móviles, prioriza la cámara trasera (environment)
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        // Conecta el video de la cámara al elemento HTML
        cameraStream.srcObject = mediaStream;
        scannerStatusMessage.textContent = "Cámara activa. Escaneando carta...";
        scannerStatusMessage.style.color = "#10b981";
        
        // Inicia el proceso de lectura (temporizador)
        startScanningProcess();
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        scannerStatusMessage.textContent = "Error: Por favor permite el acceso a la cámara.";
        scannerStatusMessage.style.color = "#ef4444";
    }
}

function stopCamera() {
    // Apaga la luz de la cámara
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    // Detiene el temporizador si se cierra antes
    if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
    }
}

function startScanningProcess() {
    // Aquí es donde irá la lógica OCR (Reconocimiento de Texto) en el futuro
    // Por ahora, simularemos que "logra leer" la carta después de 3.5 segundos de enfocar
    scanTimeout = setTimeout(() => {
        
        // 1. TOMA LA FOTO INVISIBLE (Captura el frame exacto del video)
        const context = captureCanvas.getContext('2d');
        captureCanvas.width = cameraStream.videoWidth;
        captureCanvas.height = cameraStream.videoHeight;
        context.drawImage(cameraStream, 0, 0, captureCanvas.width, captureCanvas.height);
        
        // 2. Apaga la cámara y cierra el escáner
        stopCamera();
        closeModal(scannerModal);
        
        // 3. Abre el formulario con los datos encontrados (Ejemplo)
        processScannedCardData();
        
    }, 3500); // 3.5 segundos escaneando en vivo
}

function processScannedCardData() {
    openModal(cardModal);
    cardModalTitle.textContent = 'Carta Detectada';
    
    // Estos son los datos que la futura API entregará
    cardName.value = 'Charizard VMAX (Escaneado)';
    cardPrice.value = '45.00';
    cardImage.value = 'https://assets.pokemon.com/assets/cms2/img/cards/web/swsh3/swsh3_en_20.png';
    
    // Verificamos si la categoría existe, si no, la añadimos para que no de error
    if(cardCategory.options.length === 0) {
        const option = document.createElement('option');
        option.value = 'Darkness Ablaze';
        option.text = 'Darkness Ablaze';
        cardCategory.appendChild(option);
    } else {
        let exists = Array.from(cardCategory.options).some(opt => opt.value === 'Darkness Ablaze');
        if(!exists) {
            const option = document.createElement('option');
            option.value = 'Darkness Ablaze';
            option.text = 'Darkness Ablaze';
            cardCategory.appendChild(option);
        }
    }
    cardCategory.value = 'Darkness Ablaze';
    
    // Efecto visual de que se llenó solo
    cardName.style.backgroundColor = '#ecfdf5';
    setTimeout(() => cardName.style.backgroundColor = '', 2000);
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
            stock: parseInt(card.stock) || 0
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
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
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
        const matchesSearch = card.nombre?.toLowerCase().includes(searchQuery) || card.id?.toLowerCase().includes(searchQuery);
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
            row.innerHTML = `
                <td>${card.id}</td>
                <td><img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'"></td>
                <td>${card.nombre}</td>
                <td>$${card.precio.toFixed(2)}</td>
                <td>${card.stock}</td>
                <td>${card.categoria}</td>
                <td class="action-buttons">
                    <button class="edit-button edit-card-btn" data-id="${card.id}">Editar</button>
                    <button class="delete-button delete-card-btn" data-id="${card.id}">Eliminar</button>
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
                <td>${product.nombre}</td>
                <td>${product.categoria}</td>
                <td>$${product.precio.toFixed(2)}</td>
                <td>${product.stock}</td>
                <td class="action-buttons">
                    <button class="edit-sealed-product-button" data-id="${product.id}">Editar</button>
                    <button class="delete-sealed-product-button" data-id="${product.id}">Eliminar</button>
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
                <td>${category.name}</td>
                <td class="action-buttons">
                    <button class="edit-category-button" data-id="${category.id}">Editar</button>
                    <button class="delete-category-button" data-id="${category.id}">Eliminar</button>
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
                    <img src="${productData.imagen_url}" alt="${productData.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'" style="width: 40px; height: 40px;">
                    <div class="order-item-info">
                        <strong>${productData.nombre}</strong><br>
                        <span>Cant: ${item.quantity}</span> |
                        <span>Precio: $${parseFloat(productData.precio).toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
    }

    orderDetailsContent.innerHTML = `
        <div class="customer-details">
            <h4>Datos del Cliente</h4>
            <p><strong>Nombre:</strong> ${order.customerName}</p>
            <p><strong>Teléfono:</strong> ${order.customerPhone}</p>
            <p><strong>Dirección:</strong> ${order.customerAddress}</p>
        </div>
        <div class="order-items">
            <h4>Productos</h4>
            <div class="order-items-list">${itemsHtml}</div>
        </div>
        <div class="order-summary">
            <h4>Resumen</h4>
            <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
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
    const data = {
        nombre: cardName.value,
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
// EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
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

    adminSealedSearchInput = document.getElementById('adminSealedSearchInput');
    adminSealedCategoryFilter = document.getElementById('adminSealedCategoryFilter');
    adminSealedPrevPageBtn = document.getElementById('adminSealedPrevPageBtn');
    adminSealedNextPageBtn = document.getElementById('adminSealedNextPageBtn');
    adminSealedPageInfo = document.getElementById('adminSealedPageInfo');

    totalCardsCount = document.getElementById('totalCardsCount');
    totalSealedProductsCount = document.getElementById('totalSealedProductsCount');
    outOfStockCount = document.getElementById('outOfStockCount');
    uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');

    messageModal = document.getElementById('messageModal');
    closeMessageModalBtn = document.getElementById('closeMessageModal');
    messageModalTitle = document.getElementById('messageModalTitle');
    messageModalText = document.getElementById('messageModalText');
    okMessageModalBtn = document.getElementById('okMessageModal');

    orderDetailsModal = document.getElementById('orderDetailsModal');
    closeOrderDetailsModalBtn = document.getElementById('closeOrderDetailsModal');
    orderDetailsContent = document.getElementById('orderDetailsContent');
    orderStatusSelect = document.getElementById('orderStatusSelect');
    updateOrderStatusBtn = document.getElementById('updateOrderStatusBtn');

    // Referencias del escáner añadidas al inicio de los eventos
    scannerModal = document.getElementById('scannerModal');
    openScannerBtn = document.getElementById('openScannerBtn');
    closeScannerBtn = document.getElementById('closeScannerBtn');
    cameraStream = document.getElementById('cameraStream');
    captureCanvas = document.getElementById('captureCanvas');
    scannerStatusMessage = document.getElementById('scannerStatusMessage');

    openModal(loginModal);
    hideAllSections();

    // Eventos de Navegación
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', () => { sidebarMenu.classList.add('active'); sidebarOverlay.classList.add('active'); });
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => { sidebarMenu.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => { sidebarMenu.classList.remove('active'); sidebarOverlay.classList.remove('active'); });

    const navs = [{btn: navDashboard, sec: dashboardSection}, {btn: navCards, sec: cardsSection}, {btn: navSealedProducts, sec: sealedProductsSection}, {btn: navCategories, sec: categoriesSection}, {btn: navOrders, sec: ordersSection}];
    navs.forEach(nav => {
        if(nav.btn) nav.btn.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(nav.sec);
            navs.forEach(n => { if(n.btn) n.btn.classList.remove('active'); });
            nav.btn.classList.add('active');
            if (sidebarMenu) sidebarMenu.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    });

    if (navLogout) navLogout.addEventListener('click', handleLogout);

    // Eventos de Modales
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(cardModal);
            closeModal(sealedProductModal);
            closeModal(categoryModal);
            closeModal(confirmModal);
            closeModal(loginModal);
            closeModal(messageModal);
            closeModal(orderDetailsModal);
            // IMPORTANTE: Detener la cámara si se cierra el modal desde la X
            if (scannerModal && scannerModal.style.display === 'flex') {
                stopCamera();
                closeModal(scannerModal);
            }
        });
    });

    if (closeMessageModalBtn) closeMessageModalBtn.addEventListener('click', () => closeModal(messageModal));
    if (okMessageModalBtn) okMessageModalBtn.addEventListener('click', () => closeModal(messageModal));

    // EVENTOS DEL ESCÁNER
    if (openScannerBtn) {
        openScannerBtn.addEventListener('click', () => {
            openModal(scannerModal);
            startCamera();
        });
    }

    // Formularios CRUD
    if (addCardBtn) addCardBtn.addEventListener('click', () => { cardForm.reset(); cardId.value = ''; openModal(cardModal); });
    if (cardForm) cardForm.addEventListener('submit', handleSaveCard);
    
    if (addSealedProductBtn) addSealedProductBtn.addEventListener('click', () => { sealedProductForm.reset(); sealedProductId.value = ''; openModal(sealedProductModal); });
    if (sealedProductForm) sealedProductForm.addEventListener('submit', handleSaveSealedProduct);

    if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => { categoryForm.reset(); categoryId.value = ''; openModal(categoryModal); });
    if (categoryForm) categoryForm.addEventListener('submit', handleSaveCategory);

    // Tablas CRUD (Edit/Delete)
    if (cardsTable) cardsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-card-btn')) {
            const card = allCards.find(c => c.id === e.target.dataset.id);
            if (card) {
                cardId.value = card.id; cardName.value = card.nombre; cardImage.value = card.imagen_url || '';
                cardPrice.value = card.precio; cardStock.value = card.stock; cardCategory.value = card.categoria;
                openModal(cardModal);
            }
        }
        if (e.target.classList.contains('delete-card-btn')) {
            currentDeleteTarget = { type: 'card', id: e.target.dataset.id };
            openModal(confirmModal);
        }
    });

    if (sealedProductsTable) sealedProductsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-sealed-product-button')) {
            const prod = allSealedProducts.find(p => p.id === e.target.dataset.id);
            if (prod) {
                sealedProductId.value = prod.id; sealedProductName.value = prod.nombre; sealedProductImage.value = prod.imagen_url || '';
                sealedProductCategory.value = prod.categoria; sealedProductPrice.value = prod.precio; sealedProductStock.value = prod.stock;
                openModal(sealedProductModal);
            }
        }
        if (e.target.classList.contains('delete-sealed-product-button')) {
            currentDeleteTarget = { type: 'sealedProduct', id: e.target.dataset.id };
            openModal(confirmModal);
        }
    });

    if (categoriesTable) categoriesTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-category-button')) {
            const cat = allCategories.find(c => c.id === e.target.dataset.id);
            if (cat) { categoryId.value = cat.id; categoryName.value = cat.name; openModal(categoryModal); }
        }
        if (e.target.classList.contains('delete-category-button')) {
            currentDeleteTarget = { type: 'category', id: e.target.dataset.id };
            openModal(confirmModal);
        }
    });

    if (ordersTable) ordersTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-order-details-btn')) showOrderDetails(e.target.dataset.id);
    });

    if (updateOrderStatusBtn) updateOrderStatusBtn.addEventListener('click', handleUpdateOrderStatus);

    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal(confirmModal));
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteConfirmed);

    // Filtros y Paginación
    if (adminSearchInput) adminSearchInput.addEventListener('input', () => { currentCardsPage = 1; renderCardsTable(); });
    if (adminCategoryFilter) adminCategoryFilter.addEventListener('change', () => { currentCardsPage = 1; renderCardsTable(); });
    if (adminPrevPageBtn) adminPrevPageBtn.addEventListener('click', () => { if (currentCardsPage > 1) { currentCardsPage--; renderCardsTable(); } });
    if (adminNextPageBtn) adminNextPageBtn.addEventListener('click', () => { currentCardsPage++; renderCardsTable(); });

    if (adminSealedSearchInput) adminSealedSearchInput.addEventListener('input', () => { currentSealedProductsPage = 1; renderSealedProductsTable(); });
    if (adminSealedCategoryFilter) adminSealedCategoryFilter.addEventListener('change', () => { currentSealedProductsPage = 1; renderSealedProductsTable(); });
    if (adminSealedPrevPageBtn) adminSealedPrevPageBtn.addEventListener('click', () => { if (currentSealedProductsPage > 1) { currentSealedProductsPage--; renderSealedProductsTable(); } });
    if (adminSealedNextPageBtn) adminSealedNextPageBtn.addEventListener('click', () => { currentSealedProductsPage++; renderSealedProductsTable(); });

    document.getElementById('refreshAdminPageBtn')?.addEventListener('click', async () => {
        await loadAllData();
        showMessageModal("Datos Recargados", "Todos los datos han sido actualizados.");
    });

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    if (togglePasswordVisibilityBtn && passwordInput) {
        togglePasswordVisibilityBtn.addEventListener('click', function() {
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
});
