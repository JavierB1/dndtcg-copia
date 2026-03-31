// ==========================================================================
// GLOBAL VARIABLES (non-DOM related)
// ==========================================================================

// Firebase and Firestore SDK imports
import { initializeApp }
from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc }
from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

// Inicializa los servicios de Firebase.
let app;
let db;
let auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    console.error("Error: firebaseConfig no está disponible. No se pudo inicializar la app.");
}

const appId = firebaseConfig.projectId;
let userId = null;
let currentAdminUser = null;

// Arrays para almacenar los datos cargados desde Firestore
let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = []; 

// Configuración de paginación
const itemsPerPage = 10;
let currentCardsPage = 1;
let currentSealedProductsPage = 1;

// Variable para el elemento a eliminar
let currentDeleteTarget = null;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn, closeSidebarBtn, sidebarMenu, sidebarOverlay, mainHeader;
let loginModal, loginForm, loginMessage, usernameInput, passwordInput, togglePasswordVisibilityBtn;
let navDashboard, navCards, navSealedProducts, navCategories, navOrders, navLogout;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection;
let addCardBtn, addSealedProductBtn, addCategoryBtn;
let cardModal, cardModalTitle, cardForm, cardId, cardName, cardImage, cardPrice, cardStock, cardCategory, saveCardBtn;
let sealedProductModal, sealedProductModalTitle, sealedProductForm, sealedProductId, sealedProductName, sealedProductImage, sealedProductCategory, sealedProductPrice, sealedProductStock, saveSealedProductBtn;
let categoryModal, categoryModalTitle, categoryForm, categoryId, categoryName, saveCategoryBtn;
let confirmModal, confirmMessage, cancelDeleteBtn, confirmDeleteBtn;
let cardsTable, sealedProductsTable, categoriesTable, ordersTable;
let adminSearchInput, adminCategoryFilter, adminPrevPageBtn, adminNextPageBtn, adminPageInfo;
let adminSealedSearchInput, adminSealedCategoryFilter, adminSealedPrevPageBtn, adminSealedNextPageBtn, adminSealedPageInfo;
let totalCardsCount, totalSealedProductsCount, outOfStockCount, uniqueCategoriesCount;
let messageModal, closeMessageModalBtn, messageModalTitle, messageModalText, okMessageModalBtn;
let orderDetailsModal, closeOrderDetailsModalBtn, orderDetailsContent, orderStatusSelect, updateOrderStatusBtn;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => { if (section) section.classList.remove('active'); });
    if (sectionToShow) sectionToShow.classList.add('active');
}

function hideAllSections() {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection];
    sections.forEach(section => { if (section) section.classList.remove('active'); });
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
        let errorMessage = 'Error al iniciar sesión.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Correo o contraseña incorrectos.';
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
        showMessageModal("Error", 'Error al cerrar sesión.');
    }
}

onAuthStateChanged(auth, (user) => {
    currentAdminUser = user;
    userId = user ? user.uid : null;
    if (user) {
        // Si ya hay sesión, podemos cargar datos automáticamente si se desea, 
        // pero respetamos tu flujo de handleLogin.
    }
});

// ==========================================================================
// DATA LOADING FUNCTIONS
// ==========================================================================

async function loadOrdersData() {
    if (!db) return;
    try {
        const ordersCol = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
        const ordersSnapshot = await getDocs(ordersCol);
        allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderOrdersTable();
    } catch (error) { console.error(error); }
}

async function loadCategories() {
    if (!db) return;
    try {
        const categoriesCol = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
        const categorySnapshot = await getDocs(categoriesCol);
        allCategories = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateCategoryFiltersAndSelects();
        renderCategoriesTable();
    } catch (error) { console.error(error); }
}

async function loadCardsData() {
    if (!db) return;
    try {
        const cardsCol = collection(db, 'artifacts', appId, 'public', 'data', 'cards');
        const cardsSnapshot = await getDocs(cardsCol);
        allCards = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCards = allCards.map(card => ({
            ...card,
            precio: parseFloat(card.precio) || 0,
            stock: parseInt(card.stock) || 0
        }));
        renderCardsTable();
        updateDashboardStats();
    } catch (error) { console.error(error); }
}

async function loadSealedProductsData() {
    if (!db) return;
    try {
        const sealedCol = collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products');
        const sealedSnapshot = await getDocs(sealedCol);
        allSealedProducts = sealedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allSealedProducts = allSealedProducts.map(p => ({
            ...p,
            precio: parseFloat(p.precio) || 0,
            stock: parseInt(p.stock) || 0
        }));
        renderSealedProductsTable();
        updateDashboardStats();
    } catch (error) { console.error(error); }
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
    categoryNames.forEach(category => {
        const opt = `<option value="${category}">${category}</option>`;
        adminCategoryFilter.innerHTML += opt;
        adminSealedCategoryFilter.innerHTML += opt;
    });

    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
    sealedProductCategory.innerHTML = '<option value="" disabled selected>Selecciona un tipo</option>';
    categoryNames.forEach(category => {
        const opt = `<option value="${category}">${category}</option>`;
        cardCategory.innerHTML += opt;
        sealedProductCategory.innerHTML += opt;
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No hay pedidos.</td></tr>';
        return;
    }

    allOrders.forEach(order => {
        const row = tbody.insertRow();
        const orderDate = new Date(order.timestamp).toLocaleString('es-SV');
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

    const filtered = allCards.filter(card => {
        const matchesSearch = card.nombre?.toLowerCase().includes(searchQuery) || card.id?.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === "" || card.categoria === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentCardsPage - 1) * itemsPerPage;
    const cardsOnPage = filtered.slice(startIndex, startIndex + itemsPerPage);

    const tbody = cardsTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        cardsOnPage.forEach(card => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${card.id}</td>
                <td><img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.src='https://placehold.co/50x50'"></td>
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

    const filtered = allSealedProducts.filter(p => {
        const matchesSearch = p.nombre?.toLowerCase().includes(searchQuery) || p.id?.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === "" || p.categoria === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentSealedProductsPage - 1) * itemsPerPage;
    const productsOnPage = filtered.slice(startIndex, startIndex + itemsPerPage);

    const tbody = sealedProductsTable.querySelector('tbody');
    if (tbody) {
        tbody.innerHTML = '';
        productsOnPage.forEach(p => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${p.id}</td>
                <td><img src="${p.imagen_url}" alt="${p.nombre}" onerror="this.src='https://placehold.co/50x50'"></td>
                <td>${p.nombre}</td>
                <td>${p.categoria}</td>
                <td>$${p.precio.toFixed(2)}</td>
                <td>${p.stock}</td>
                <td class="action-buttons">
                    <button class="edit-sealed-product-button" data-id="${p.id}">Editar</button>
                    <button class="delete-sealed-product-button" data-id="${p.id}">Eliminar</button>
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
        allCategories.forEach(cat => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${cat.name}</td>
                <td class="action-buttons">
                    <button class="edit-category-button" data-id="${cat.id}">Editar</button>
                    <button class="delete-category-button" data-id="${cat.id}">Eliminar</button>
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
        const productData = item.type === 'card' ? allCards.find(c => c.id === itemId) : allSealedProducts.find(p => p.id === itemId);
        if (productData) {
            itemsHtml += `
                <div class="order-item">
                    <img src="${productData.imagen_url}" alt="${productData.nombre}" onerror="this.src='https://placehold.co/50x50'">
                    <div class="order-item-info">
                        <strong>${productData.nombre}</strong><br>
                        <span>Cant: ${item.quantity} | $${parseFloat(productData.precio).toFixed(2)}</span>
                    </div>
                </div>`;
        }
    }

    orderDetailsContent.innerHTML = `
        <div class="customer-details">
            <p><strong>Cliente:</strong> ${order.customerName}</p>
            <p><strong>Tel:</strong> ${order.customerPhone}</p>
            <p><strong>Dir:</strong> ${order.customerAddress}</p>
        </div>
        <div class="order-items-list">${itemsHtml}</div>
        <div class="order-summary">
            <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
            <p><strong>Estado:</strong> ${order.status}</p>
        </div>`;

    orderStatusSelect.value = order.status;
    updateOrderStatusBtn.dataset.orderId = orderId;
    openModal(orderDetailsModal);
}

async function handleUpdateOrderStatus() {
    const orderId = updateOrderStatusBtn.dataset.orderId;
    const newStatus = orderStatusSelect.value;
    const orderToUpdate = allOrders.find(o => o.id === orderId);
    if (!orderToUpdate || orderToUpdate.status === newStatus) {
        closeModal(orderDetailsModal);
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);
            if (newStatus === 'cancelled' && orderToUpdate.status !== 'cancelled') {
                const cart = JSON.parse(orderToUpdate.cart);
                for (const itemId in cart) {
                    const cItem = cart[itemId];
                    const col = cItem.type === 'card' ? 'cards' : 'sealed_products';
                    const iRef = doc(db, 'artifacts', appId, 'public', 'data', col, itemId);
                    const iDoc = await transaction.get(iRef);
                    if (iDoc.exists()) {
                        transaction.update(iRef, { stock: iDoc.data().stock + cItem.quantity });
                    }
                }
            }
            transaction.update(orderRef, { status: newStatus });
        });
        showMessageModal("Éxito", "Estado actualizado.");
        closeModal(orderDetailsModal);
        await loadAllData();
    } catch (e) { console.error(e); }
}

async function handleSaveCard(e) {
    e.preventDefault();
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
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        }
        cardForm.reset();
        closeModal(cardModal);
        await loadCardsData();
    } catch (e) { console.error(e); }
}

async function handleSaveSealedProduct(e) {
    e.preventDefault();
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
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sealed_products', id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'), data);
        }
        sealedProductForm.reset();
        closeModal(sealedProductModal);
        await loadSealedProductsData();
    } catch (e) { console.error(e); }
}

async function handleSaveCategory(e) {
    e.preventDefault();
    const id = categoryId.value;
    const data = { name: categoryName.value };
    try {
        if (id) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), data);
        }
        categoryForm.reset();
        closeModal(categoryModal);
        await loadAllData();
    } catch (e) { console.error(e); }
}

async function handleDeleteConfirmed() {
    const { type, id } = currentDeleteTarget;
    const colName = type === 'card' ? 'cards' : (type === 'sealedProduct' ? 'sealed_products' : 'categories');
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id));
        closeModal(confirmModal);
        await loadAllData();
    } catch (e) { console.error(e); }
}

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
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

    openModal(loginModal);
    hideAllSections();

    // Eventos Sidebar
    if (sidebarToggleBtn) sidebarToggleBtn.onclick = () => { sidebarMenu.classList.add('active'); sidebarOverlay.classList.add('active'); };
    if (closeSidebarBtn) closeSidebarBtn.onclick = () => { sidebarMenu.classList.remove('active'); sidebarOverlay.classList.remove('active'); };
    if (sidebarOverlay) sidebarOverlay.onclick = () => { sidebarMenu.classList.remove('active'); sidebarOverlay.classList.remove('active'); };

    // Navegación
    const navItems = [
        { btn: navDashboard, sec: dashboardSection },
        { btn: navCards, sec: cardsSection },
        { btn: navSealedProducts, sec: sealedProductsSection },
        { btn: navCategories, sec: categoriesSection },
        { btn: navOrders, sec: ordersSection }
    ];

    navItems.forEach(item => {
        if (item.btn) item.btn.onclick = (e) => {
            e.preventDefault();
            showSection(item.sec);
            navItems.forEach(i => i.btn?.classList.remove('active'));
            item.btn.classList.add('active');
            sidebarMenu.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };
    });

    if (navLogout) navLogout.onclick = (e) => { e.preventDefault(); handleLogout(); };

    // Modales Close
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.onclick = () => { 
            closeModal(cardModal); closeModal(sealedProductModal); closeModal(categoryModal); 
            closeModal(confirmModal); closeModal(orderDetailsModal); closeModal(messageModal);
        };
    });

    if (okMessageModalBtn) okMessageModalBtn.onclick = () => closeModal(messageModal);

    // CRUD Eventos
    if (addCardBtn) addCardBtn.onclick = () => { cardModalTitle.textContent = "Añadir Nueva Carta"; cardId.value = ''; cardForm.reset(); openModal(cardModal); };
    if (cardForm) cardForm.onsubmit = handleSaveCard;
    if (cardsTable) cardsTable.onclick = (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-card-btn')) {
            const c = allCards.find(x => x.id === id);
            if (c) {
                cardModalTitle.textContent = "Editar Carta"; cardId.value = c.id;
                cardName.value = c.nombre; cardImage.value = c.imagen_url;
                cardPrice.value = c.precio; cardStock.value = c.stock;
                cardCategory.value = c.categoria; openModal(cardModal);
            }
        }
        if (e.target.classList.contains('delete-card-btn')) {
            currentDeleteTarget = { type: 'card', id: id };
            confirmMessage.textContent = "¿Eliminar carta?";
            openModal(confirmModal);
        }
    };

    if (addSealedProductBtn) addSealedProductBtn.onclick = () => { sealedProductModalTitle.textContent = "Añadir Sellado"; sealedProductId.value = ''; sealedProductForm.reset(); openModal(sealedProductModal); };
    if (sealedProductForm) sealedProductForm.onsubmit = handleSaveSealedProduct;
    if (sealedProductsTable) sealedProductsTable.onclick = (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-sealed-product-button')) {
            const p = allSealedProducts.find(x => x.id === id);
            if (p) {
                sealedProductModalTitle.textContent = "Editar Sellado"; sealedProductId.value = p.id;
                sealedProductName.value = p.nombre; sealedProductImage.value = p.imagen_url;
                sealedProductCategory.value = p.categoria; sealedProductPrice.value = p.precio;
                sealedProductStock.value = p.stock; openModal(sealedProductModal);
            }
        }
        if (e.target.classList.contains('delete-sealed-product-button')) {
            currentDeleteTarget = { type: 'sealedProduct', id: id };
            confirmMessage.textContent = "¿Eliminar producto?";
            openModal(confirmModal);
        }
    };

    if (addCategoryBtn) addCategoryBtn.onclick = () => { categoryModalTitle.textContent = "Añadir Categoría"; categoryId.value = ''; categoryForm.reset(); openModal(categoryModal); };
    if (categoryForm) categoryForm.onsubmit = handleSaveCategory;
    if (categoriesTable) categoriesTable.onclick = (e) => {
        const id = e.target.dataset.id;
        if (e.target.classList.contains('edit-category-button')) {
            const cat = allCategories.find(x => x.id === id);
            if (cat) { categoryModalTitle.textContent = "Editar Categoría"; categoryId.value = cat.id; categoryName.value = cat.name; openModal(categoryModal); }
        }
        if (e.target.classList.contains('delete-category-button')) {
            currentDeleteTarget = { type: 'category', id: id };
            confirmMessage.textContent = "¿Eliminar categoría?";
            openModal(confirmModal);
        }
    };

    if (ordersTable) ordersTable.onclick = (e) => { if (e.target.classList.contains('view-order-details-btn')) showOrderDetails(e.target.dataset.id); };
    if (updateOrderStatusBtn) updateOrderStatusBtn.onclick = handleUpdateOrderStatus;
    if (confirmDeleteBtn) confirmDeleteBtn.onclick = handleDeleteConfirmed;
    if (cancelDeleteBtn) cancelDeleteBtn.onclick = () => closeModal(confirmModal);

    // Filtros
    if (adminSearchInput) adminSearchInput.oninput = () => { currentCardsPage = 1; renderCardsTable(); };
    if (adminCategoryFilter) adminCategoryFilter.onchange = () => { currentCardsPage = 1; renderCardsTable(); };
    if (adminPrevPageBtn) adminPrevPageBtn.onclick = () => { if (currentCardsPage > 1) { currentCardsPage--; renderCardsTable(); } };
    if (adminNextPageBtn) adminNextPageBtn.onclick = () => { currentCardsPage++; renderCardsTable(); };

    if (loginForm) loginForm.onsubmit = handleLogin;
    if (togglePasswordVisibilityBtn) togglePasswordVisibilityBtn.onclick = () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const icon = togglePasswordVisibilityBtn.querySelector('i');
        icon.classList.toggle('fa-eye'); icon.classList.toggle('fa-eye-slash');
    };
});
