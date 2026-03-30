// ==========================================================================
// GLOBAL VARIABLES (non-DOM related)
// ==========================================================================

// Firebase and Firestore SDK imports
// Importaciones de los SDK de Firebase y Firestore
import { initializeApp }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

// Your actual Firebase configuration for dndtcgadmin project
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

// Initialize Firebase services
// Inicializa los servicios de Firebase.
// Se verifica si la configuración de Firebase es válida antes de inicializar.
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

// Application ID and User ID
// ID de la aplicación y del usuario
const appId = firebaseConfig.projectId;
let userId = null;
let currentAdminUser = null;

// Arrays para almacenar los datos cargados desde Firestore
// Arrays to store loaded data from Firestore
let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = []; // <-- Array para los pedidos

// Configuración de paginación
// Pagination configuration
const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedProductsPage = 1;

// Variable para el elemento a eliminar
// Variable for the item to be deleted
let currentDeleteTarget = null;


// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn;
let closeSidebarBtn; // <-- Referencia para el nuevo botón
let sidebarMenu;
let sidebarOverlay;
let mainHeader;
let loginModal;
let loginForm;
let loginMessage;
let usernameInput;
let passwordInput;
let togglePasswordVisibilityBtn; // Elemento para el botón de alternar visibilidad

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
let ordersSection; // <-- Referencia para la nueva sección

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
let ordersTable; // <-- Referencia para la nueva tabla

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

// Referencias para el nuevo modal de detalles de pedido
let orderDetailsModal;
let closeOrderDetailsModalBtn;
let orderDetailsContent;
let orderStatusSelect;
let updateOrderStatusBtn;


// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

/**
 * Muestra una sección del panel de administración y oculta las demás.
 * @param {HTMLElement} sectionToShow - El elemento DOM de la sección a mostrar.
 */
function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
    if (sectionToShow) {
        sectionToShow.classList.add('active');
    }
}

/**
 * Oculta todas las secciones del panel de administración.
 */
function hideAllSections() {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
}

/**
 * Abre un modal.
 * @param {HTMLElement} modalElement - El elemento modal a abrir.
 */
function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Cierra un modal.
 * @param {HTMLElement} modalElement - El elemento modal a cerrar.
 */
function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.style.overflow = '';
    }
}

/**
 * Muestra un mensaje de error en el modal de login.
 * @param {string} message - El mensaje a mostrar.
 */
function showLoginError(message) {
    if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.style.display = 'block';
    }
}

/**
 * Limpia el mensaje de error del modal de login.
 */
function clearLoginError() {
    if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.style.display = 'none';
    }
}

/**
 * Muestra un modal de mensaje personalizado.
 * @param {string} title - El título del mensaje.
 * @param {string} text - El texto del mensaje.
 */
function showMessageModal(title, text) {
    if (messageModalTitle) messageModalTitle.textContent = title;
    if (messageModalText) messageModalText.textContent = text;
    openModal(messageModal);
}


// ==========================================================================
// FIREBASE AUTHENTICATION FUNCTIONS
// ==========================================================================

/**
 * Maneja el proceso de inicio de sesión del administrador.
 * @param {Event} event - El evento de envío del formulario.
 */
async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';
    clearLoginError();

    try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log('Administrador ha iniciado sesión con Firebase Auth.');
        closeModal(loginModal); // Cierra el modal solo si el login fue exitoso
        showSection(dashboardSection); // Muestra la sección de dashboard
        // Carga los datos después de un inicio de sesión exitoso
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
        } else {
            errorMessage = `Error desconocido: ${error.message}. Por favor, revisa la consola para más detalles.`;
        }
        showLoginError(errorMessage);
    }
}

/**
 * Maneja el proceso de cierre de sesión del administrador.
 */
async function handleLogout() {
    try {
        await signOut(auth);
        userId = null;
        currentAdminUser = null;
        console.log('Sesión cerrada con Firebase Auth.');
        hideAllSections(); // Oculta todas las secciones del administrador
        openModal(loginModal); // Muestra el modal de login al cerrar sesión
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showMessageModal("Error al cerrar sesión", 'Error al cerrar sesión. Por favor, inténtalo de nuevo.');
    }
}

// Firebase Auth State Listener: Se ejecuta cuando el estado de autenticación cambia
// Este listener ahora solo actualiza las variables de estado, no manipula la UI
onAuthStateChanged(auth, (user) => {
    currentAdminUser = user;
    userId = user ? user.uid : null;
    console.log('Cambio de estado de autenticación de Firebase. Usuario:', userId);

    // No se manipula la UI aquí para evitar que se salte el login.
    // La carga de datos y la visibilidad de la UI se gestiona en handleLogin y handleLogout
});


// ==========================================================================
// DATA LOADING FUNCTIONS (All from Firestore now)
// ==========================================================================

/**
 * Carga todos los pedidos desde Firestore.
 */
async function loadOrdersData() {
    if (!db) {
        console.error("No se pudo cargar pedidos: la base de datos no está inicializada.");
        return;
    }
    try {
        const ordersCol = collection(db, `artifacts/${appId}/public/data/orders`);
        const ordersSnapshot = await getDocs(ordersCol);
        allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordenar pedidos por fecha, del más reciente al más antiguo
        allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderOrdersTable();
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        showMessageModal("Error de Carga", 'Error al cargar los pedidos. Consulta la consola para más detalles.');
    }
}


/**
 * Carga todas las categorías desde Firestore.
 * Loads all categories from Firestore.
 */
async function loadCategories() {
    // Si la inicialización falló, no intentes cargar datos.
    if (!db) {
        console.error("No se pudo cargar categorías: la base de datos no está inicializada.");
        return;
    }
    try {
        const categoriesCol = collection(db, `artifacts/${appId}/public/data/categories`);
        const categorySnapshot = await getDocs(categoriesCol);
        allCategories = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateCategoryFiltersAndSelects();
        renderCategoriesTable();
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        showMessageModal("Error de Carga", 'Error al cargar categorías. Consulta la consola para más detalles.');
    }
}

/**
 * Carga todos los datos de cartas desde Firestore.
 * Loads all card data from Firestore.
 */
async function loadCardsData() {
    // Si la inicialización falló, no intentes cargar datos.
    if (!db) {
        console.error("No se pudo cargar cartas: la base de datos no está inicializada.");
        return;
    }
    try {
        const cardsCol = collection(db, `artifacts/${appId}/public/data/cards`);
        const cardsSnapshot = await getDocs(cardsCol);
        allCards = cardsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        allCards = allCards.map(card => ({
            ...card,
            precio: parseFloat(card.precio) || 0,
            stock: parseInt(card.stock) || 0
        }));
        renderCardsTable();
        updateDashboardStats();
    } catch (error) {
        console.error('Error al cargar datos de cartas:', error);
        showMessageModal("Error de Carga", 'Error al cargar cartas. Consulta la consola para más detalles.');
    }
}

/**
 * Carga todos los datos de productos sellados desde Firestore.
 * Loads all sealed product data from Firestore.
 */
async function loadSealedProductsData() {
    // Si la inicialización falló, no intentes cargar datos.
    if (!db) {
        console.error("No se pudo cargar productos sellados: la base de datos no está inicializada.");
        return;
    }
    try {
        const sealedProductsCol = collection(db, `artifacts/${appId}/public/data/sealed_products`);
        const sealedProductsSnapshot = await getDocs(sealedProductsCol);
        allSealedProducts = sealedProductsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        allSealedProducts = allSealedProducts.map(product => ({
            ...product,
            precio: parseFloat(product.precio) || 0,
            stock: parseInt(product.stock) || 0
        }));
        console.log('Datos de productos sellados cargados:', allSealedProducts);
        renderSealedProductsTable();
        updateDashboardStats();
    } catch (error) {
        console.error('Error al cargar datos de productos sellados:', error);
        showMessageModal("Error de Carga", 'Error al cargar productos sellados. Consulta la consola para más detalles.');
    }
}

/**
 * Carga todos los datos necesarios para el panel de administración.
 * Loads all necessary data for the admin panel.
 */
async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    await loadSealedProductsData();
    await loadOrdersData(); // <-- Cargar también los pedidos
}

/**
 * Rellena los filtros de categoría y los menús desplegables en los formularios.
 * Populates category filters and select elements in forms.
 */
function populateCategoryFiltersAndSelects() {
    if (!adminCategoryFilter || !adminSealedCategoryFilter || !cardCategory || !sealedProductCategory) {
        console.warn("Elementos DOM para filtros de categoría no disponibles. Verifica los IDs en el HTML.");
        return;
    }

    const categoryNames = allCategories.map(cat => cat.name);

    adminCategoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    categoryNames.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        adminCategoryFilter.appendChild(option);
    });

    adminSealedCategoryFilter.innerHTML = '<option value="">Todos los tipos</option>';
    categoryNames.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        adminSealedCategoryFilter.appendChild(option);
    });

    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
    sealedProductCategory.innerHTML = '<option value="" disabled selected>Selecciona un tipo</option>';

    categoryNames.forEach(category => {
        const cardOption = document.createElement('option');
        cardOption.value = category;
        cardOption.textContent = category;
        cardCategory.appendChild(cardOption);

        const sealedOption = document.createElement('option');
        sealedOption.value = category;
        sealedOption.textContent = category;
        sealedProductCategory.appendChild(sealedOption);
    });
}

// ==========================================================================
// TABLE RENDERING FUNCTIONS
// ==========================================================================

/**
 * Renderiza la tabla de pedidos.
 */
function renderOrdersTable() {
    if (!ordersTable) {
        console.warn("Elemento DOM para la tabla de pedidos no disponible.");
        return;
    }
    const tbody = ordersTable.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // Limpiar la tabla antes de renderizar

    if (allOrders.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6; // Ocupa todas las columnas
        cell.textContent = 'No hay pedidos para mostrar.';
        cell.style.textAlign = 'center';
        return;
    }

    allOrders.forEach(order => {
        const row = tbody.insertRow();
        const orderDate = new Date(order.timestamp).toLocaleString('es-SV'); // Formato de fecha local

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


/**
 * Renderiza la tabla de cartas con filtrado y paginación.
 * Renders the cards table with filtering and pagination.
 */
function renderCardsTable() {
    if (!cardsTable || !adminSearchInput || !adminCategoryFilter || !adminPrevPageBtn || !adminNextPageBtn || !adminPageInfo) {
        console.warn("Elementos DOM para la tabla de cartas no disponibles. Verifica los IDs en el HTML.");
        return;
    }

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

    if (adminPageInfo) {
        adminPageInfo.textContent = `Página ${currentCardsPage} de ${totalPages || 1}`;
    }
    if (adminPrevPageBtn) {
        adminPrevPageBtn.disabled = currentCardsPage <= 1;
    }
    if (adminNextPageBtn) {
        adminNextPageBtn.disabled = currentCardsPage >= totalPages;
    }
}

/**
 * Renderiza la tabla de productos sellados con filtrado y paginación.
 * Renders the sealed products table with filtering and pagination.
 */
function renderSealedProductsTable() {
    if (!sealedProductsTable || !adminSealedSearchInput || !adminSealedCategoryFilter || !adminSealedPrevPageBtn || !adminSealedNextPageBtn || !adminSealedPageInfo) {
        console.warn("Elementos DOM para la tabla de productos sellados no disponibles. Verifica los IDs en el HTML.");
        return;
    }

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

    if (adminSealedPageInfo) {
        adminSealedPageInfo.textContent = `Página ${currentSealedProductsPage} de ${totalPages || 1}`;
    }
    if (adminSealedPrevPageBtn) {
        adminSealedPrevPageBtn.disabled = currentSealedProductsPage <= 1;
    }
    if (adminSealedNextPageBtn) {
        adminSealedNextPageBtn.disabled = currentSealedProductsPage >= totalPages;
    }
}

/**
 * Renderiza la tabla de categorías.
 * Renders the categories table.
 */
function renderCategoriesTable() {
    if (!categoriesTable) {
        console.warn("Elemento DOM para la tabla de categorías no disponible. Verifica el ID en el HTML.");
        return;
    }

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

/**
 * Actualiza las estadísticas en el dashboard.
 * Updates the dashboard stats.
 */
function updateDashboardStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (totalSealedProductsCount) totalSealedProductsCount.textContent = allSealedProducts.length;
    if (outOfStockCount) outOfStockCount.textContent = allCards.filter(c => c.stock === 0).length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
}

// ==========================================================================
// CRUD OPERATIONS (All using Firestore now)
// ==========================================================================

/**
 * Muestra los detalles de un pedido específico en un modal.
 * @param {string} orderId - El ID del pedido a mostrar.
 */
function showOrderDetails(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showMessageModal("Error", "No se pudo encontrar el pedido.");
        return;
    }

    let itemsHtml = '';
    const cart = JSON.parse(order.cart);
    for (const itemId in cart) {
        const item = cart[itemId];
        let productData = null;
        if (item.type === 'card') {
            productData = allCards.find(c => c.id === itemId);
        } else {
            productData = allSealedProducts.find(p => p.id === itemId);
        }

        if (productData) {
            itemsHtml += `
                <div class="order-item">
                    <img src="${productData.imagen_url}" alt="${productData.nombre}" onerror="this.src='https://placehold.co/50x50/2d3748/a0aec0?text=No+Img'">
                    <div class="order-item-info">
                        <strong>${productData.nombre}</strong><br>
                        <span>Cantidad: ${item.quantity}</span> |
                        <span>Precio Unitario: $${parseFloat(productData.precio).toFixed(2)}</span>
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
            <p><strong>Total del Pedido:</strong> $${parseFloat(order.total).toFixed(2)}</p>
            <p><strong>Estado Actual:</strong> ${order.status}</p>
        </div>
    `;

    // Selecciona el estado actual en el dropdown
    orderStatusSelect.value = order.status;
    // Guarda el ID del pedido en el botón para usarlo al actualizar
    updateOrderStatusBtn.dataset.orderId = orderId;

    openModal(orderDetailsModal);
}

/**
 * Actualiza el estado de un pedido en Firestore y ajusta el inventario si es necesario.
 */
async function handleUpdateOrderStatus() {
    const orderId = updateOrderStatusBtn.dataset.orderId;
    const newStatus = orderStatusSelect.value;

    if (!orderId) {
        showMessageModal("Error", "No se ha seleccionado ningún pedido.");
        return;
    }

    const orderToUpdate = allOrders.find(o => o.id === orderId);
    if (!orderToUpdate) {
        showMessageModal("Error", "Pedido no encontrado.");
        return;
    }

    const oldStatus = orderToUpdate.status;

    if (oldStatus === newStatus) {
        closeModal(orderDetailsModal);
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const orderDocRef = doc(db, `artifacts/${appId}/public/data/orders`, orderId);

            if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
                const cart = JSON.parse(orderToUpdate.cart);
                const stockUpdatePromises = [];
                const itemsToUpdate = [];

                // Fase 1: Recopilar todas las lecturas
                for (const itemId in cart) {
                    const cartItem = cart[itemId];
                    const collectionName = cartItem.type === 'card' ? 'cards' : 'sealed_products';
                    const itemRef = doc(db, `artifacts/${appId}/public/data/${collectionName}`, itemId);
                    stockUpdatePromises.push(transaction.get(itemRef).then(itemDoc => ({ itemDoc, cartItem })));
                }
                
                const results = await Promise.all(stockUpdatePromises);

                // Fase 2: Preparar las escrituras
                for (const { itemDoc, cartItem } of results) {
                    if (itemDoc.exists()) {
                        const currentStock = itemDoc.data().stock;
                        const newStock = currentStock + cartItem.quantity;
                        itemsToUpdate.push({ ref: itemDoc.ref, newStock });
                    }
                }

                // Fase 3: Ejecutar todas las escrituras
                itemsToUpdate.forEach(update => {
                    transaction.update(update.ref, { stock: update.newStock });
                });
            }
            
            transaction.update(orderDocRef, { status: newStatus });
        });

        showMessageModal("Éxito", "El estado del pedido ha sido actualizado.");
        closeModal(orderDetailsModal);
        await loadAllData();

    } catch (error) {
        console.error("Error al actualizar el estado del pedido:", error);
        showMessageModal("Error", "No se pudo actualizar el estado del pedido.");
    }
}


/**
 * Maneja el envío del formulario para añadir/editar una carta.
 * Handles the form submission for adding/editing a card.
 * @param {Event} event - El evento de envío del formulario.
 */
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

    if (!data.categoria) {
        showMessageModal("Error de Validación", "Por favor, selecciona una categoría para la carta.");
        return;
    }

    try {
        if (id) {
            const cardDocRef = doc(db, `artifacts/${appId}/public/data/cards`, id);
            await updateDoc(cardDocRef, data);
            showMessageModal("Éxito", "Carta actualizada correctamente.");
        } else {
            const cardsCol = collection(db, `artifacts/${appId}/public/data/cards`);
            await addDoc(cardsCol, data);
            showMessageModal("Éxito", "Carta añadida correctamente.");
        }
        cardForm.reset();
        closeModal(cardModal);
        await loadCardsData();
    } catch (error) {
        console.error('Error al guardar carta:', error);
        showMessageModal("Error de Operación", `Operación fallida: ${error.message}`);
    }
}

/**
 * Maneja el envío del formulario para añadir/editar un producto sellado.
 * Handles the form submission for adding/editing a sealed product.
 * @param {Event} event - El evento de envío del formulario.
 */
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

    if (!data.categoria) {
        showMessageModal("Error de Validación", "Por favor, selecciona un tipo para el producto sellado.");
        return;
    }

    try {
        if (id) {
            const sealedProductDocRef = doc(db, `artifacts/${appId}/public/data/sealed_products`, id);
            await updateDoc(sealedProductDocRef, data);
            showMessageModal("Éxito", "Producto sellado actualizado correctamente.");
        } else {
            const sealedProductsCol = collection(db, `artifacts/${appId}/public/data/sealed_products`);
            await addDoc(sealedProductsCol, data);
            showMessageModal("Éxito", "Producto sellado añadido correctamente.");
        }
        sealedProductForm.reset();
        closeModal(sealedProductModal);
        await loadSealedProductsData();
    } catch (error) {
        console.error('Error al guardar producto sellado:', error);
        showMessageModal("Error de Operación", `Operación fallida: ${error.message}`);
    }
}

/**
 * Maneja el envío del formulario para añadir/editar una categoría.
 * Handles the form submission for adding/editing a category.
 * @param {Event} event - El evento de envío del formulario.
 */
async function handleSaveCategory(event) {
    event.preventDefault();

    const id = categoryId.value;
    const data = {
        name: categoryName.value
    };

    try {
        if (id) {
            const categoryDocRef = doc(db, `artifacts/${appId}/public/data/categories`, id);
            await updateDoc(categoryDocRef, data);
            showMessageModal("Éxito", "Categoría actualizada correctamente.");
        } else {
            const categoriesCol = collection(db, `artifacts/${appId}/public/data/categories`);
            await addDoc(categoriesCol, data);
            showMessageModal("Éxito", "Categoría añadida correctamente.");
        }
        categoryForm.reset();
        closeModal(categoryModal);
        await loadCategories();
        await loadCardsData();
        await loadSealedProductsData();
    } catch (error) {
        console.error('Error al guardar categoría:', error);
        showMessageModal("Error de Operación", `Operación fallida: ${error.message}`);
    }
}

/**
 * Elimina un elemento (carta, producto sellado o categoría) después de la confirmación.
 * Deletes an item (card, sealed product, or category) after confirmation.
 */
async function handleDeleteConfirmed() {
    const { type, id } = currentDeleteTarget;
    try {
        if (type === 'card') {
            const cardDocRef = doc(db, `artifacts/${appId}/public/data/cards`, id);
            await deleteDoc(cardDocRef);
            showMessageModal("Éxito", "Carta eliminada correctamente.");
            await loadCardsData();
        } else if (type === 'sealedProduct') {
            const sealedProductDocRef = doc(db, `artifacts/${appId}/public/data/sealed_products`, id);
            await deleteDoc(sealedProductDocRef);
            showMessageModal("Éxito", "Producto sellado eliminado correctamente.");
            await loadSealedProductsData();
        } else if (type === 'category') {
            const categoryDocRef = doc(db, `artifacts/${appId}/public/data/categories`, id);
            await deleteDoc(categoryDocRef);
            showMessageModal("Éxito", "Categoría eliminada correctamente.");
            await loadCategories();
            await loadCardsData();
            await loadSealedProductsData();
        }
        closeModal(confirmModal);
    } catch (error) {
        console.error('Error al eliminar elemento:', error);
        showMessageModal("Error de Operación", `Operación fallida: ${error.message}`);
    }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Asignación de elementos DOM
    sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    closeSidebarBtn = document.getElementById('closeSidebarBtn'); // <-- Asignación del nuevo botón
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    mainHeader = document.querySelector('.main-header');
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
    ordersSection = document.getElementById('orders-section'); // <-- Asignación de la nueva sección

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
    saveCardBtn = document.getElementById('saveCardBtn');

    sealedProductModal = document.getElementById('sealedProductModal');
    sealedProductModalTitle = document.getElementById('sealedProductModalTitle');
    sealedProductForm = document.getElementById('sealedProductForm');
    sealedProductId = document.getElementById('sealedProductId');
    sealedProductName = document.getElementById('sealedProductName');
    sealedProductImage = document.getElementById('sealedProductImage');
    sealedProductCategory = document.getElementById('sealedProductCategory');
    sealedProductPrice = document.getElementById('sealedProductPrice');
    sealedProductStock = document.getElementById('sealedProductStock');
    saveSealedProductBtn = document.getElementById('saveSealedProductBtn');

    categoryModal = document.getElementById('categoryModal');
    categoryModalTitle = document.getElementById('categoryModalTitle');
    categoryForm = document.getElementById('categoryForm');
    categoryId = document.getElementById('categoryId');
    categoryName = document.getElementById('categoryName');
    saveCategoryBtn = document.getElementById('saveCategoryBtn');

    confirmModal = document.getElementById('confirmModal');
    confirmMessage = document.getElementById('confirmMessage');
    cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    cardsTable = document.getElementById('cardsTable');
    sealedProductsTable = document.getElementById('sealedProductsTable');
    categoriesTable = document.getElementById('categoriesTable');
    ordersTable = document.getElementById('ordersTable'); // <-- Asignación de la nueva tabla

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

    // Asignación para el nuevo modal de detalles de pedido
    orderDetailsModal = document.getElementById('orderDetailsModal');
    closeOrderDetailsModalBtn = document.getElementById('closeOrderDetailsModal');
    orderDetailsContent = document.getElementById('orderDetailsContent');
    orderStatusSelect = document.getElementById('orderStatusSelect');
    updateOrderStatusBtn = document.getElementById('updateOrderStatusBtn');

    // ------------------- Initial Load Control -------------------
    // Inicia la aplicación con el modal de login abierto y sin secciones activas.
    // Esto asegura que el usuario siempre vea la pantalla de login primero.
    openModal(loginModal);
    hideAllSections();

    // ------------------- Navigation -------------------
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            if (sidebarMenu) sidebarMenu.classList.add('active');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        });
    }

    // NUEVO: Event listener para el botón de cerrar el sidebar
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            if (sidebarMenu) sidebarMenu.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            if (sidebarMenu) sidebarMenu.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    }

    if (navDashboard) navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(dashboardSection);
        navDashboard.classList.add('active');
        navCards.classList.remove('active');
        navSealedProducts.classList.remove('active');
        navCategories.classList.remove('active');
        navOrders.classList.remove('active');
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    });

    if (navCards) navCards.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(cardsSection);
        navCards.classList.add('active');
        navDashboard.classList.remove('active');
        navSealedProducts.classList.remove('active');
        navCategories.classList.remove('active');
        navOrders.classList.remove('active');
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    });

    if (navSealedProducts) navSealedProducts.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(sealedProductsSection);
        navSealedProducts.classList.add('active');
        navDashboard.classList.remove('active');
        navCards.classList.remove('active');
        navCategories.classList.remove('active');
        navOrders.classList.remove('active');
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    });

    if (navCategories) navCategories.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(categoriesSection);
        navCategories.classList.add('active');
        navDashboard.classList.remove('active');
        navCards.classList.remove('active');
        navSealedProducts.classList.remove('active');
        navOrders.classList.remove('active');
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    });
    
    // Event listener para la nueva sección de pedidos
    if (navOrders) navOrders.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(ordersSection);
        navOrders.classList.add('active');
        navDashboard.classList.remove('active');
        navCards.classList.remove('active');
        navSealedProducts.classList.remove('active');
        navCategories.classList.remove('active');
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    });


    if (navLogout) navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });

    // ------------------- Modals -------------------
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(cardModal);
            closeModal(sealedProductModal);
            closeModal(categoryModal);
            closeModal(confirmModal);
            closeModal(loginModal);
            closeModal(messageModal);
            closeModal(orderDetailsModal); // <-- Cerrar también el modal de detalles
        });
    });

    if (window) {
        window.onclick = function(event) {
            if (event.target == cardModal) closeModal(cardModal);
            if (event.target == sealedProductModal) closeModal(sealedProductModal);
            if (event.target == categoryModal) closeModal(categoryModal);
            if (event.target == confirmModal) closeModal(confirmModal);
            if (event.target == orderDetailsModal) closeModal(orderDetailsModal);
            // El modal de login no se debe cerrar al hacer clic fuera
            if (event.target == messageModal) closeModal(messageModal);
        };
    }

    if (closeMessageModalBtn) closeMessageModalBtn.addEventListener('click', () => closeModal(messageModal));
    if (okMessageModalBtn) okMessageModalBtn.addEventListener('click', () => closeModal(messageModal));

    // ------------------- Card Management -------------------
    if (addCardBtn) addCardBtn.addEventListener('click', () => {
        cardModalTitle.textContent = "Añadir Nueva Carta";
        cardId.value = '';
        cardForm.reset();
        if (cardCategory) cardCategory.value = '';
        openModal(cardModal);
    });

    if (cardsTable) cardsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-card-btn')) {
            const id = e.target.dataset.id;
            const cardToEdit = allCards.find(c => c.id === id);
            if (cardToEdit) {
                cardModalTitle.textContent = "Editar Carta";
                cardId.value = cardToEdit.id;
                cardName.value = cardToEdit.nombre;
                cardImage.value = cardToEdit.imagen_url || '';
                cardPrice.value = cardToEdit.precio;
                cardStock.value = cardToEdit.stock;
                cardCategory.value = cardToEdit.categoria;
                openModal(cardModal);
            }
        }
        if (e.target.classList.contains('delete-card-btn')) {
            const id = e.target.dataset.id;
            currentDeleteTarget = { type: 'card', id: id };
            if (confirmMessage) confirmMessage.textContent = `¿Estás seguro de que quieres eliminar la carta con ID ${id}?`;
            openModal(confirmModal);
        }
    });

    if (cardForm) cardForm.addEventListener('submit', handleSaveCard);

    if (adminSearchInput) adminSearchInput.addEventListener('input', () => {
        currentCardsPage = 1;
        renderCardsTable();
    });
    if (adminCategoryFilter) adminCategoryFilter.addEventListener('change', () => {
        currentCardsPage = 1;
        renderCardsTable();
    });
    if (adminPrevPageBtn) adminPrevPageBtn.addEventListener('click', () => {
        if (currentCardsPage > 1) {
            currentCardsPage--;
            renderCardsTable();
        }
    });
    if (adminNextPageBtn) adminNextPageBtn.addEventListener('click', () => {
        currentCardsPage++;
        renderCardsTable();
    });

    // ------------------- Sealed Product Management -------------------
    if (addSealedProductBtn) addSealedProductBtn.addEventListener('click', () => {
        sealedProductModalTitle.textContent = "Añadir Nuevo Producto Sellado";
        sealedProductId.value = '';
        sealedProductForm.reset();
        if (sealedProductCategory) sealedProductCategory.value = '';
        openModal(sealedProductModal);
    });

    if (sealedProductsTable) sealedProductsTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-sealed-product-button')) {
            const id = e.target.dataset.id;
            const productToEdit = allSealedProducts.find(p => p.id === id);
            if (productToEdit) {
                sealedProductModalTitle.textContent = "Editar Producto Sellado";
                sealedProductId.value = productToEdit.id;
                sealedProductName.value = productToEdit.nombre;
                sealedProductImage.value = productToEdit.imagen_url || '';
                sealedProductCategory.value = productToEdit.categoria;
                sealedProductPrice.value = productToEdit.precio;
                sealedProductStock.value = productToEdit.stock;
                openModal(sealedProductModal);
            }
        }
        if (e.target.classList.contains('delete-sealed-product-button')) {
            const id = e.target.dataset.id;
            currentDeleteTarget = { type: 'sealedProduct', id: id };
            if (confirmMessage) confirmMessage.textContent = `¿Estás seguro de que quieres eliminar el producto sellado con ID ${id}?`;
            openModal(confirmModal);
        }
    });

    if (sealedProductForm) sealedProductForm.addEventListener('submit', handleSaveSealedProduct);

    if (adminSealedSearchInput) adminSealedSearchInput.addEventListener('input', () => {
        currentSealedProductsPage = 1;
        renderSealedProductsTable();
    });
    if (adminSealedCategoryFilter) adminSealedCategoryFilter.addEventListener('change', () => {
        currentSealedProductsPage = 1;
        renderSealedProductsTable();
    });
    if (adminSealedPrevPageBtn) adminSealedPrevPageBtn.addEventListener('click', () => {
        if (currentSealedProductsPage > 1) {
            currentSealedProductsPage--;
            renderSealedProductsTable();
        }
    });
    if (adminSealedNextPageBtn) adminSealedNextPageBtn.addEventListener('click', () => {
        currentSealedProductsPage++;
        renderSealedProductsTable();
    });

    // ------------------- Category Management -------------------
    if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => {
        categoryModalTitle.textContent = "Añadir Nueva Categoría";
        categoryId.value = '';
        categoryForm.reset();
        openModal(categoryModal);
    });

    if (categoriesTable) categoriesTable.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-category-button')) {
            const id = e.target.dataset.id;
            const categoryToEdit = allCategories.find(c => c.id === id);
            if (categoryToEdit) {
                categoryModalTitle.textContent = "Editar Categoría";
                categoryId.value = categoryToEdit.id;
                categoryName.value = categoryToEdit.name;
                openModal(categoryModal);
            }
        }
        if (e.target.classList.contains('delete-category-button')) {
            const id = e.target.dataset.id;
            currentDeleteTarget = { type: 'category', id: id };
            if (confirmMessage) confirmMessage.textContent = `¿Estás seguro de que quieres eliminar la categoría? Esto no eliminará las cartas asociadas.`;
            openModal(confirmModal);
        }
    });

    if (categoryForm) categoryForm.addEventListener('submit', handleSaveCategory);

    // ------------------- Order Management -------------------
    if (ordersTable) {
        ordersTable.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-order-details-btn')) {
                const orderId = e.target.dataset.id;
                showOrderDetails(orderId);
            }
        });
    }
    
    // Event listener para el botón de actualizar estado del pedido
    if (updateOrderStatusBtn) {
        updateOrderStatusBtn.addEventListener('click', handleUpdateOrderStatus);
    }


    // ------------------- Confirmation Modal -------------------
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal(confirmModal));
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteConfirmed);

    // ------------------- Refresh Button -------------------
    const refreshAdminPageBtn = document.getElementById('refreshAdminPageBtn');
    if (refreshAdminPageBtn) {
        refreshAdminPageBtn.addEventListener('click', async () => {
            showMessageModal("Recargando Datos", "Por favor, espera mientras actualizamos los datos...");
            await loadAllData();
            closeModal(messageModal);
            showMessageModal("Datos Recargados", "Todos los datos han sido actualizados.");
        });
    }

    // ------------------- Login form handler -------------------
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // ------------------- Toggle password visibility -------------------
    if (togglePasswordVisibilityBtn && passwordInput) {
        togglePasswordVisibilityBtn.addEventListener('click', function() {
            // Alternar el tipo de input entre 'password' y 'text'
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Alternar la clase del icono para cambiar entre ojo abierto y cerrado
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });
    }
});