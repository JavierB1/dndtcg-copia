// ==========================================================================
// GLOBAL VARIABLES AND DOM REFERENCES
// ==========================================================================

// Firebase and Firestore SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, addDoc, runTransaction, getDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.appspot.com", // Corregido el dominio del storage bucket
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

// Initialize Firebase with the obtained configuration
let app;
let db;
let auth;

if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    console.error('Firebase configuration is incomplete or invalid. Firebase services will not be initialized.');
    showMessageModal('Error de Configuración', 'La aplicación no pudo cargar la configuración de Firebase.');
}

// Application ID and User ID
const appId = firebaseConfig.projectId;
let userId = null;

// Arrays para almacenar datos
let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let cart = JSON.parse(localStorage.getItem('cart')) || {};
let currentDeliveryMethod = 'delivery'; // 'delivery' or 'pickup'

// Configuración de paginación
let currentCardsPage = 1;
let currentSealedProductsPage = 1;
const itemsPerPage = 10;

// DOM Element References
const abrirModalProductosBtn = document.getElementById('abrirModalProductos');
const productSelectionModal = document.getElementById('productSelectionModal');
const closeProductSelectionModalBtn = document.getElementById('closeProductSelectionModal');
const openCardsModalBtn = document.getElementById('openCardsModalBtn');
const openSealedProductsModalBtn = document.getElementById('openSealedProductsModalBtn');

const cardsModal = document.getElementById('cardsModal');
const closeCardsModalBtn = document.getElementById('closeCardsModal');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const cardsContainer = document.getElementById('cardsContainer');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');

const sealedProductsModal = document.getElementById('sealedProductsModal');
const closeSealedProductsModalBtn = document.getElementById('closeSealedProductsModal');
const sealedSearchInput = document.getElementById('sealedSearchInput');
const sealedTypeFilter = document.getElementById('sealedTypeFilter');
const sealedProductsContainer = document.getElementById('sealedProductsContainer');
const sealedPrevPageBtn = document.getElementById('sealedPrevPageBtn');
const sealedNextPageBtn = document.getElementById('sealedNextPageBtn');
const sealedPageInfo = document.getElementById('sealedPageInfo');

const abrirCarritoBtn = document.getElementById('abrirCarrito');
const cartCounter = document.getElementById('cartCounter'); // <-- Referencia para el contador
const modalCarrito = document.getElementById('modalCarrito');
const cerrarCarritoBtn = document.getElementById('cerrarCarrito');
const listaCarrito = document.getElementById('lista-carrito');
const vaciarCarritoBtn = document.getElementById('vaciarCarrito');
const openCheckoutModalBtn = document.getElementById('openCheckoutModalBtn');

// Referencias para el nuevo modal de selección de entrega
const deliveryMethodModal = document.getElementById('deliveryMethodModal');
const closeDeliveryMethodModalBtn = document.getElementById('closeDeliveryMethodModal');
const deliveryOptionBtn = document.getElementById('deliveryOptionBtn');
const pickupOptionBtn = document.getElementById('pickupOptionBtn');

const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutModalBtn = document.getElementById('closeCheckoutModal');
const checkoutTitle = document.getElementById('checkoutTitle');
const checkoutForm = document.getElementById('checkoutForm');
const customerNameInput = document.getElementById('customerName');
const customerPhoneInput = document.getElementById('customerPhone');
const customerAddressInput = document.getElementById('customerAddress');
const phoneField = document.getElementById('phoneField');
const addressField = document.getElementById('addressField');
const confirmOrderBtn = document.getElementById('confirmOrderBtn');
const checkoutLoadingSpinner = document.getElementById('checkoutLoadingSpinner');

const messageModal = document.getElementById('messageModal');
const closeMessageModalBtn = document.getElementById('closeMessageModal');
const messageModalTitle = document.getElementById('messageModalTitle');
const messageModalText = document.getElementById('messageModalText');
const okMessageModalBtn = document.getElementById('okMessageModal');

const viewAllCardsBtn = document.getElementById('viewAllCardsBtn');
const dynamicFloatingCardsContainer = document.getElementById('dynamicFloatingCardsContainer');
const addedToCartNotification = document.getElementById('addedToCartNotification');
const modalCartBtns = document.querySelectorAll('.modal-cart-btn'); // <-- Referencia para los botones flotantes


// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showMessageModal(title, message) {
    messageModalTitle.textContent = title;
    messageModalText.textContent = message;
    messageModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeMessageModal() {
    messageModal.style.display = 'none';
    document.body.style.overflow = '';
}

function showAddedToCartNotification(itemName) {
    if (addedToCartNotification) {
        addedToCartNotification.textContent = `${itemName} agregado al carrito`;
        addedToCartNotification.classList.add('show');
        setTimeout(() => {
            addedToCartNotification.classList.remove('show');
        }, 1500);
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

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCounter(); // <-- Actualizar el contador cada vez que se guarda el carrito
}

// ==========================================================================
// DATA LOADING FUNCTIONS (FROM FIREBASE)
// ==========================================================================

async function loadCategories() {
    if (!db) return;
    try {
        const categoriesCol = collection(db, `artifacts/${appId}/public/data/categories`);
        const categorySnapshot = await getDocs(categoriesCol);
        allCategories = categorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateCategoryFilter();
        populateSealedTypeFilter();
    } catch (error) {
        console.error('Error loading categories from Firestore:', error);
        showMessageModal('Error de Carga', 'No se pudieron cargar las categorías.');
    }
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
        renderCards();
        renderFloatingCards();
    } catch (error) {
        console.error('Error loading cards data from Firestore:', error);
        showMessageModal('Error de Carga', 'No se pudieron cargar las cartas.');
    }
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
        renderSealedProducts();
    } catch (error) {
        console.error('Error loading sealed products from Firestore:', error);
        showMessageModal('Error de Carga', 'No se pudieron cargar los productos sellados.');
    }
}

function populateCategoryFilter() {
    if (!categoryFilter) return;
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
    allCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        categoryFilter.appendChild(option);
    });
}

function populateSealedTypeFilter() {
    if (!sealedTypeFilter) return;
    sealedTypeFilter.innerHTML = '<option value="">Todos los tipos</option>';
    allCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        sealedTypeFilter.appendChild(option);
    });
}

// ==========================================================================
// RENDERING FUNCTIONS
// ==========================================================================

function renderFloatingCards() {
    if (!dynamicFloatingCardsContainer) return;
    dynamicFloatingCardsContainer.innerHTML = '';
    const cardsToDisplay = allCards
        .filter(card => card.imagen_url && typeof card.imagen_url === 'string' && card.imagen_url.startsWith('http'))
        .slice(0, 10);
    if (cardsToDisplay.length === 0) {
        dynamicFloatingCardsContainer.innerHTML = '<p style="text-align: center; color: #666; margin-top: 20px;">No hay cartas disponibles para mostrar.</p>';
        return;
    }
    const cardElements = cardsToDisplay.map(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('floating-card');
        cardElement.innerHTML = `<img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/150x210/cccccc/333333?text=No+Image';" />`;
        return cardElement;
    });
    cardElements.forEach(el => dynamicFloatingCardsContainer.appendChild(el));
    if (cardsToDisplay.length > 1) {
        cardElements.forEach(el => {
            const clone = el.cloneNode(true);
            dynamicFloatingCardsContainer.appendChild(clone);
        });
    }
    const numCards = cardsToDisplay.length;
    const animationDuration = numCards * 4;
    dynamicFloatingCardsContainer.style.animation = `scroll ${animationDuration}s linear infinite`;
}

function renderCards() {
    if (!cardsContainer || !searchInput || !categoryFilter) return;
    cardsContainer.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value;
    let filteredCards = allCards.filter(card => {
        const matchesSearch = card.nombre.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === '' || card.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    filteredCards.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
    const startIndex = (currentCardsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const cardsToDisplay = filteredCards.slice(startIndex, endIndex);
    if (cardsToDisplay.length === 0) {
        cardsContainer.innerHTML = '<p style="text-align: center; color: #666; margin-top: 20px;">No se encontraron cartas.</p>';
    }
    cardsToDisplay.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('carta');
        cardElement.innerHTML = `
            <img src="${card.imagen_url}" alt="${card.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/180x250/cccccc/333333?text=No+Image';" />
            <h4>${card.nombre}</h4>
            <p>Precio: $${card.precio.toFixed(2)}</p>
            <p>Stock: ${card.stock}</p>
            <div class="quantity-controls">
                <button class="decrease-quantity" data-id="${card.id}" data-type="card">-</button>
                <input type="number" class="quantity-input" value="1" min="1" max="${card.stock}" data-id="${card.id}" data-type="card">
                <button class="increase-quantity" data-id="${card.id}" data-type="card">+</button>
            </div>
            <button class="agregar-carrito" data-id="${card.id}" data-type="card" ${card.stock === 0 ? 'disabled' : ''}>
                ${card.stock === 0 ? 'Agotado' : 'Añadir al Carrito'}
            </button>
        `;
        cardsContainer.appendChild(cardElement);
    });
    updatePaginationControls(currentCardsPage, totalPages, pageInfo, prevPageBtn, nextPageBtn, filteredCards.length);
}

function renderSealedProducts() {
    if (!sealedProductsContainer || !sealedSearchInput || !sealedTypeFilter) return;
    sealedProductsContainer.innerHTML = '';
    const searchTerm = sealedSearchInput.value.toLowerCase();
    const selectedType = sealedTypeFilter.value;
    let filteredProducts = allSealedProducts.filter(product => {
        const matchesSearch = product.nombre.toLowerCase().includes(searchTerm);
        const matchesType = selectedType === '' || product.categoria === selectedType;
        return matchesSearch && matchesType;
    });
    filteredProducts.sort((a, b) => a.nombre.localeCompare(b.nombre));
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentSealedProductsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const productsToDisplay = filteredProducts.slice(startIndex, endIndex);
    if (productsToDisplay.length === 0) {
        sealedProductsContainer.innerHTML = '<p style="text-align: center; color: #666; margin-top: 20px;">No se encontraron productos sellados.</p>';
    }
    productsToDisplay.forEach(product => {
        const productElement = document.createElement('div');
        productElement.classList.add('carta');
        productElement.innerHTML = `
            <img src="${product.imagen_url}" alt="${product.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/180x250/cccccc/333333?text=No+Image';" />
            <h4>${product.nombre}</h4>
            <p>Tipo: ${product.categoria}</p>
            <p>Precio: $${product.precio.toFixed(2)}</p>
            <p>Stock: ${product.stock}</p>
            <div class="quantity-controls">
                <button class="decrease-quantity" data-id="${product.id}" data-type="sealed">-</button>
                <input type="number" class="quantity-input" value="1" min="1" max="${product.stock}" data-id="${product.id}" data-type="sealed">
                <button class="increase-quantity" data-id="${product.id}" data-type="sealed">+</button>
            </div>
            <button class="agregar-carrito" data-id="${product.id}" data-type="sealed" ${product.stock === 0 ? 'disabled' : ''}>
                ${product.stock === 0 ? 'Agotado' : 'Añadir al Carrito'}
            </button>
        `;
        sealedProductsContainer.appendChild(productElement);
    });
    updatePaginationControls(currentSealedProductsPage, totalPages, sealedPageInfo, sealedPrevPageBtn, sealedNextPageBtn, filteredProducts.length);
}

function updatePaginationControls(currentPage, totalPages, infoSpan, prevBtn, nextBtn, totalItems) {
    if (!infoSpan || !prevBtn || !nextBtn) return;
    infoSpan.textContent = `Página ${currentPage} de ${totalPages || 1} (${totalItems} items)`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
}

function renderCart() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = '';
    let total = 0;
    if (Object.keys(cart).length === 0) {
        listaCarrito.innerHTML = '<p style="text-align: center; color: #666;">El carrito está vacío.</p>';
        vaciarCarritoBtn.disabled = true;
        openCheckoutModalBtn.disabled = true;
        return;
    } else {
        vaciarCarritoBtn.disabled = false;
        openCheckoutModalBtn.disabled = false;
    }
    for (const id in cart) {
        const itemInCart = cart[id];
        const itemElement = document.createElement('div');
        itemElement.classList.add('cart-item');
        let productData = null;
        if (itemInCart.type === 'card') {
            productData = allCards.find(c => c.id === id);
        } else if (itemInCart.type === 'sealed') {
            productData = allSealedProducts.find(p => p.id === id);
        }
        if (productData) {
            itemElement.innerHTML = `
                <img src="${productData.imagen_url}" alt="${productData.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/70x70/cccccc/333333?text=No+Image';" />
                <div class="item-details">
                    <h4>${productData.nombre}</h4>
                    <p>Precio: $${productData.precio.toFixed(2)}</p>
                    <p>Subtotal: $${(itemInCart.quantity * productData.precio).toFixed(2)}</p>
                </div>
                <div class="quantity-controls-cart">
                    <button class="decrease-cart-quantity" data-id="${id}" data-type="${itemInCart.type}">-</button>
                    <input type="number" class="quantity-input-cart" value="${itemInCart.quantity}" min="1" max="${productData.stock}" data-id="${id}" data-type="${itemInCart.type}">
                    <button class="increase-cart-quantity" data-id="${id}" data-type="${itemInCart.type}">+</button>
                </div>
                <button class="eliminar-item" data-id="${id}" data-type="${itemInCart.type}">Eliminar</button>
            `;
            listaCarrito.appendChild(itemElement);
            total += itemInCart.quantity * productData.precio;
        }
    }
    const totalElement = document.createElement('div');
    totalElement.classList.add('cart-total');
    totalElement.innerHTML = `<h3>Total: $${total.toFixed(2)}</h3>`;
    listaCarrito.appendChild(totalElement);
}

// ==========================================================================
// CART MANAGEMENT FUNCTIONS
// ==========================================================================

function updateCartCounter() {
    // Calcula la cantidad total de artículos sumando las cantidades de cada item en el carrito
    const totalQuantity = Object.values(cart).reduce((total, item) => total + item.quantity, 0);
    
    const counters = document.querySelectorAll('.cart-counter');
    counters.forEach(counter => {
        counter.textContent = totalQuantity;
        if (totalQuantity > 0) {
            counter.classList.add('active');
        } else {
            counter.classList.remove('active');
        }
    });
}

function addToCart(id, type, quantityToAdd, showNotification = true) {
    let itemData = null;
    if (type === 'card') {
        itemData = allCards.find(c => c.id === id);
    } else if (type === 'sealed') {
        itemData = allSealedProducts.find(p => p.id === id);
    }
    if (!itemData) {
        showMessageModal('Error', 'Producto no encontrado.');
        return;
    }
    const currentQuantityInCart = cart[id] ? cart[id].quantity : 0;
    const newQuantity = currentQuantityInCart + quantityToAdd;
    if (newQuantity > itemData.stock) {
        showMessageModal('Stock Insuficiente', `Solo hay ${itemData.stock} unidades de "${itemData.nombre}" disponibles.`);
        return;
    }
    if (newQuantity <= 0) {
        delete cart[id];
    } else {
        cart[id] = {
            id: id,
            type: type,
            quantity: newQuantity
        };
    }
    saveCart();
    renderCart();
    renderCards();
    renderSealedProducts();
    if (showNotification && quantityToAdd > 0) {
        showAddedToCartNotification(itemData.nombre);
    }
}

function removeFromCart(id) {
    delete cart[id];
    saveCart();
    renderCart();
    renderCards();
    renderSealedProducts();
}

function clearCart() {
    cart = {};
    saveCart();
    renderCart();
    renderCards();
    renderSealedProducts();
}

// ==========================================================================
// CHECKOUT FUNCTIONS
// ==========================================================================

async function confirmOrder() {
    const customerName = customerNameInput.value.trim();
    const customerPhone = (currentDeliveryMethod === 'delivery') ? customerPhoneInput.value.trim() : '';
    const customerAddress = (currentDeliveryMethod === 'delivery') ? customerAddressInput.value.trim() : 'Retiro en Tienda';

    if (!customerName || (currentDeliveryMethod === 'delivery' && (!customerPhone || !customerAddress))) {
        showMessageModal('Error', 'Por favor, completa todos los campos requeridos.');
        return;
    }
    if (Object.keys(cart).length === 0) {
        showMessageModal('Carrito Vacío', 'No hay productos en tu carrito.');
        return;
    }

    confirmOrderBtn.disabled = true;
    checkoutLoadingSpinner.style.display = 'inline-block';

    try {
        if (!db) throw new Error('Firestore no está inicializado.');
        await runTransaction(db, async (transaction) => {
            const itemsToUpdate = [];
            let totalOrderPrice = 0;
            for (const itemId in cart) {
                const cartItem = cart[itemId];
                const collectionName = cartItem.type === 'card' ? 'cards' : 'sealed_products';
                const itemRef = doc(db, `artifacts/${appId}/public/data/${collectionName}`, itemId);
                const itemDoc = await transaction.get(itemRef);
                if (!itemDoc.exists()) throw new Error(`El producto con ID ${itemId} ya no existe.`);
                const currentStock = itemDoc.data().stock;
                if (currentStock < cartItem.quantity) throw new Error(`Stock insuficiente para ${itemDoc.data().nombre}.`);
                const newStock = currentStock - cartItem.quantity;
                itemsToUpdate.push({ ref: itemRef, newStock });
                totalOrderPrice += (itemDoc.data().precio * cartItem.quantity);
            }
            itemsToUpdate.forEach(item => transaction.update(item.ref, { stock: item.newStock }));
            const ordersCol = collection(db, `artifacts/${appId}/public/data/orders`);
            const newOrderRef = doc(ordersCol);
            transaction.set(newOrderRef, {
                customerName,
                customerPhone,
                customerAddress,
                cart: JSON.stringify(cart),
                total: totalOrderPrice,
                timestamp: new Date().toISOString(),
                status: 'pending',
                deliveryMethod: currentDeliveryMethod
            });
        });

        let orderDetails = 'Pedido de Deck and Drift\n\n';
        orderDetails += `*Tipo de Pedido:* ${currentDeliveryMethod === 'delivery' ? 'Envío a Domicilio' : 'Retiro en Tienda'}\n`;
        orderDetails += `*Cliente:* ${customerName}\n`;
        if (currentDeliveryMethod === 'delivery') {
            orderDetails += `*Dirección:* ${customerAddress}\n`;
        }
        orderDetails += '\n*Detalles del Pedido:*\n';
        let finalTotal = 0;
        for (const id in cart) {
            const item = cart[id];
            let productInfo = item.type === 'card' ? allCards.find(c => c.id === id) : allSealedProducts.find(p => p.id === id);
            if (productInfo) {
                const subtotal = item.quantity * productInfo.precio;
                orderDetails += `- ${item.quantity}x ${productInfo.nombre} ($${productInfo.precio.toFixed(2)} c/u) - Subtotal: $${subtotal.toFixed(2)}\n`;
                finalTotal += subtotal;
            }
        }
        orderDetails += `\n*Total del Pedido:* $${finalTotal.toFixed(2)}\n\n¡Gracias por tu compra!`;
        const whatsappMessage = encodeURIComponent(orderDetails);
        const whatsappUrl = `https://wa.me/50374785424?text=${whatsappMessage}`;
        
        window.open(whatsappUrl, '_blank');
        showMessageModal('Pedido Confirmado', 'Tu pedido ha sido enviado. ¡Gracias por tu compra!');
        clearCart();
        closeModal(checkoutModal);
        checkoutForm.reset();
        await loadCardsData();
        await loadSealedProductsData();

    } catch (error) {
        console.error('Error al confirmar el pedido:', error);
        if (error.message.includes("Stock insuficiente")) {
            showMessageModal('Stock Agotado', `Lo sentimos, uno de los productos de tu carrito se agotó mientras finalizabas la compra. Por favor, revisa tu carrito.`);
        } else {
            showMessageModal('Error al Confirmar', `Hubo un problema al procesar tu pedido: ${error.message}.`);
        }
    } finally {
        confirmOrderBtn.disabled = false;
        checkoutLoadingSpinner.style.display = 'none';
    }
}

// ==========================================================================
// INITIALIZATION AND EVENT LISTENERS
// ==========================================================================

async function initializeAppAndData() {
    if (!auth) {
        console.error('Firebase Auth no está inicializado.');
        showMessageModal('Error Crítico', 'La autenticación no está disponible.');
        return;
    }
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
        } else {
            try {
                const userCredential = await signInAnonymously(auth);
                userId = userCredential.user.uid;
            } catch (error) {
                console.error('Error signing in anonymously:', error);
                showMessageModal('Error de Autenticación', 'No se pudo iniciar sesión anónimamente.');
                return;
            }
        }
        await loadCategories();
        await loadCardsData();
        await loadSealedProductsData();
        updateCartCounter(); // <-- Actualizar contador al cargar la página
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAppAndData();

    if (abrirModalProductosBtn) abrirModalProductosBtn.addEventListener('click', () => openModal(productSelectionModal));
    if (closeProductSelectionModalBtn) closeProductSelectionModalBtn.addEventListener('click', () => closeModal(productSelectionModal));
    if (openCardsModalBtn) openCardsModalBtn.addEventListener('click', () => {
        closeModal(productSelectionModal);
        openModal(cardsModal);
        currentCardsPage = 1;
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        renderCards();
    });
    if (openSealedProductsModalBtn) openSealedProductsModalBtn.addEventListener('click', () => {
        closeModal(productSelectionModal);
        openModal(sealedProductsModal);
        currentSealedProductsPage = 1;
        if (sealedSearchInput) sealedSearchInput.value = '';
        if (sealedTypeFilter) sealedTypeFilter.value = '';
        renderSealedProducts();
    });

    if (closeCardsModalBtn) closeCardsModalBtn.addEventListener('click', () => closeModal(cardsModal));
    if (closeSealedProductsModalBtn) closeSealedProductsModalBtn.addEventListener('click', () => closeModal(sealedProductsModal));
    if (abrirCarritoBtn) abrirCarritoBtn.addEventListener('click', () => {
        renderCart();
        openModal(modalCarrito);
    });
    if (cerrarCarritoBtn) cerrarCarritoBtn.addEventListener('click', () => closeModal(modalCarrito));

    // Lógica de Checkout
    if (openCheckoutModalBtn) openCheckoutModalBtn.addEventListener('click', () => {
        closeModal(modalCarrito);
        openModal(deliveryMethodModal);
    });
    if (closeDeliveryMethodModalBtn) closeDeliveryMethodModalBtn.addEventListener('click', () => closeModal(deliveryMethodModal));
    
    if (deliveryOptionBtn) deliveryOptionBtn.addEventListener('click', () => {
        currentDeliveryMethod = 'delivery';
        checkoutTitle.textContent = 'Datos para Envío a Domicilio';
        phoneField.classList.remove('hidden');
        addressField.classList.remove('hidden');
        customerPhoneInput.required = true;
        customerAddressInput.required = true;
        closeModal(deliveryMethodModal);
        openModal(checkoutModal);
    });

    if (pickupOptionBtn) pickupOptionBtn.addEventListener('click', () => {
        currentDeliveryMethod = 'pickup';
        checkoutTitle.textContent = 'Datos para Retiro en Tienda';
        phoneField.classList.add('hidden');
        addressField.classList.add('hidden');
        customerPhoneInput.required = false;
        customerAddressInput.required = false;
        closeModal(deliveryMethodModal);
        openModal(checkoutModal);
    });

    if (closeCheckoutModalBtn) closeCheckoutModalBtn.addEventListener('click', () => closeModal(checkoutModal));
    if (okMessageModalBtn) okMessageModalBtn.addEventListener('click', closeMessageModal);
    if (closeMessageModalBtn) closeMessageModalBtn.addEventListener('click', closeMessageModal);

    if (searchInput) searchInput.addEventListener('input', () => { currentCardsPage = 1; renderCards(); });
    if (categoryFilter) categoryFilter.addEventListener('change', () => { currentCardsPage = 1; renderCards(); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentCardsPage > 1) { currentCardsPage--; renderCards(); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
        const filtered = allCards.filter(c => c.nombre.toLowerCase().includes(searchInput.value.toLowerCase()) && (categoryFilter.value === '' || c.categoria === categoryFilter.value));
        if (currentCardsPage < Math.ceil(filtered.length / itemsPerPage)) { currentCardsPage++; renderCards(); }
    });

    if (sealedSearchInput) sealedSearchInput.addEventListener('input', () => { currentSealedProductsPage = 1; renderSealedProducts(); });
    if (sealedTypeFilter) sealedTypeFilter.addEventListener('change', () => { currentSealedProductsPage = 1; renderSealedProducts(); });
    if (sealedPrevPageBtn) sealedPrevPageBtn.addEventListener('click', () => { if (currentSealedProductsPage > 1) { currentSealedProductsPage--; renderSealedProducts(); } });
    if (sealedNextPageBtn) sealedNextPageBtn.addEventListener('click', () => {
        const filtered = allSealedProducts.filter(p => p.nombre.toLowerCase().includes(sealedSearchInput.value.toLowerCase()) && (sealedTypeFilter.value === '' || p.categoria === sealedTypeFilter.value));
        if (currentSealedProductsPage < Math.ceil(filtered.length / itemsPerPage)) { currentSealedProductsPage++; renderSealedProducts(); }
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('agregar-carrito')) {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            const quantityInput = e.target.closest('.carta').querySelector('.quantity-input');
            let quantityToAdd = parseInt(quantityInput.value);
            if (isNaN(quantityToAdd) || quantityToAdd < 1) quantityToAdd = 1;
            addToCart(id, type, quantityToAdd, true);
        } else if (e.target.classList.contains('increase-quantity')) {
            const input = e.target.parentNode.querySelector('.quantity-input');
            let maxStock = parseInt(input.getAttribute('max'));
            if (parseInt(input.value) < maxStock) input.value = parseInt(input.value) + 1;
        } else if (e.target.classList.contains('decrease-quantity')) {
            const input = e.target.parentNode.querySelector('.quantity-input');
            if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
        } else if (e.target.classList.contains('eliminar-item')) {
            removeFromCart(e.target.dataset.id);
        } else if (e.target.classList.contains('increase-cart-quantity')) {
            addToCart(e.target.dataset.id, e.target.dataset.type, 1, false);
        } else if (e.target.classList.contains('decrease-cart-quantity')) {
            addToCart(e.target.dataset.id, e.target.dataset.type, -1, false);
        }
    });
    
    if (vaciarCarritoBtn) vaciarCarritoBtn.addEventListener('click', clearCart);
    if (confirmOrderBtn) confirmOrderBtn.addEventListener('click', confirmOrder);

    if (viewAllCardsBtn) viewAllCardsBtn.addEventListener('click', () => {
        openModal(cardsModal);
        currentCardsPage = 1;
        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = '';
        renderCards();
    });

    // Event listener para los botones de carrito flotantes
    modalCartBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(cardsModal);
            closeModal(sealedProductsModal);
            renderCart();
            openModal(modalCarrito);
        });
    });
});
