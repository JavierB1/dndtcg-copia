// ==========================================================================
// DECK & DRIFT TCG - LÓGICA DE TIENDA (PÚBLICA)
// Optimizado para interacciones rápidas y bloqueos de scroll en móviles
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, doc, onSnapshot, runTransaction, addDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515"
};

// Inicialización de Servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Estado de la Aplicación
let products = [];      // Unificación local de 'cards' (singles) y 'sealedProducts'
let categories = [];
let cart = [];

let currentTypeFilter = 'all';    // 'all', 'single', 'sealed'
let currentCategoryFilter = '';   // Filtrado por categoría específica (nombre)

// Referencias del DOM
const productsGrid = document.getElementById('productsGrid');
const categoriesContainer = document.getElementById('categoriesContainer');
const searchInput = document.getElementById('searchInput');
const sortBy = document.getElementById('sortBy');

const singlesCountEl = document.getElementById('singlesCount');
const sealedCountEl = document.getElementById('sealedCount');
const resultsCountEl = document.getElementById('resultsCount');
const currentFilterTitle = document.getElementById('currentFilterTitle');

// Botones de filtro de Tipo
const btnAllTypes = document.getElementById('btnAllTypes');
const btnSinglesType = document.getElementById('btnSinglesType');
const btnSealedType = document.getElementById('btnSealedType');

// Elementos del Drawer de Carrito (Acciones de Escritorio y Barra Flotante Móvil)
const cartBtn = document.getElementById('cartBtn');
const mobileFloatingCartBtn = document.getElementById('mobileFloatingCartBtn');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartTotalValue = document.getElementById('cartTotalValue');
const cartBadge = document.getElementById('cartBadge');
const mobileCartBadge = document.getElementById('mobileCartBadge');

// Formulario de Checkout
const checkoutForm = document.getElementById('checkoutForm');
const customerDelivery = document.getElementById('customerDelivery');
const addressField = document.getElementById('addressField');
const customerAddress = document.getElementById('customerAddress');

// Modal de Éxito
const successModal = document.getElementById('successModal');
const btnSuccessClose = document.getElementById('btnSuccessClose');

// ==========================================
// 1. AUTENTICACIÓN ANÓNIMA & SINCRONIZACIÓN
// ==========================================
async function startApp() {
    try {
        // Nos autenticamos de forma anónima para que Firebase permita escribir el pedido
        await signInAnonymously(auth);
        
        // Recuperar carrito local si existe
        const storedCart = localStorage.getItem('dnd_tcg_cart');
        if (storedCart) {
            cart = JSON.parse(storedCart);
            updateCartUI();
        }

        initSync();
    } catch (error) {
        console.error("Error al arrancar la aplicación:", error);
        showToast("Hubo un error de conexión con la base de datos.", "warning");
    }
}

// Escuchar datos en tiempo real de Firebase
function initSync() {
    // Sincronizar Categorías
    onSnapshot(collection(db, "categories"), (snapshot) => {
        categories = [];
        snapshot.forEach(docSnap => {
            categories.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderCategories();
    });

    // Sincronizar Singles (Colección 'cards')
    onSnapshot(collection(db, "cards"), (cardsSnapshot) => {
        let cardsList = [];
        cardsSnapshot.forEach(docSnap => {
            cardsList.push({ id: docSnap.id, type: 'single', ...docSnap.data() });
        });

        // Sincronizar Producto Sellado (Colección 'sealedProducts')
        onSnapshot(collection(db, "sealedProducts"), (sealedSnapshot) => {
            let sealedList = [];
            sealedSnapshot.forEach(docSnap => {
                sealedList.push({ id: docSnap.id, type: 'sealed', ...docSnap.data() });
            });

            // Combinar ambos inventarios
            products = [...cardsList, ...sealedList];

            // Actualizar Contadores de la barra lateral
            singlesCountEl.textContent = cardsList.length;
            sealedCountEl.textContent = sealedList.length;

            // Renderizar la tienda y sincronizar límites del carrito actual
            renderProducts();
            syncCartWithDatabase();
        });
    });
}

// ==========================================
// 2. RENDERIZACIÓN DE INTERFAZ Y COMPONENTES
// ==========================================
function renderCategories() {
    categoriesContainer.innerHTML = '';

    // Botón para limpiar filtro de categorías
    const allCatBtn = document.createElement('button');
    allCatBtn.className = `category-btn ${!currentCategoryFilter ? 'active' : ''}`;
    allCatBtn.innerHTML = `<span><i class="fas fa-tags"></i> Todas</span>`;
    allCatBtn.addEventListener('click', () => {
        currentCategoryFilter = '';
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        allCatBtn.classList.add('active');
        renderProducts();
    });
    categoriesContainer.appendChild(allCatBtn);

    // Listar categorías traídas de Firebase
    categories.forEach(cat => {
        const itemBtn = document.createElement('button');
        itemBtn.className = `category-btn ${currentCategoryFilter === cat.name ? 'active' : ''}`;
        
        // Obtener cantidad de productos en esta categoría
        const count = products.filter(p => p.category === cat.name).length;

        itemBtn.innerHTML = `
            <span><i class="fas fa-tag"></i> ${cat.name}</span>
            <span class="badge">${count}</span>
        `;
        itemBtn.addEventListener('click', () => {
            currentCategoryFilter = cat.name;
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            itemBtn.classList.add('active');
            renderProducts();
        });
        categoriesContainer.appendChild(itemBtn);
    });
}

function renderProducts() {
    productsGrid.innerHTML = '';

    // Filtrar por Tipo de Producto (Single vs Sellado)
    let list = products;
    if (currentTypeFilter !== 'all') {
        list = list.filter(p => p.type === currentTypeFilter);
    }

    // Filtrar por Categoría / Juego
    if (currentCategoryFilter) {
        list = list.filter(p => p.category === currentCategoryFilter);
    }

    // Filtrar por Entrada de Búsqueda
    const searchVal = searchInput.value.toLowerCase().trim();
    if (searchVal) {
        list = list.filter(p => {
            const name = (p.name || '').toLowerCase();
            const set = (p.expansion || p.set || '').toLowerCase();
            const rarity = (p.rarity || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const code = (p.code || '').toLowerCase();
            return name.includes(searchVal) || set.includes(searchVal) || rarity.includes(searchVal) || category.includes(searchVal) || code.includes(searchVal);
        });
    }

    // Aplicar Ordenamiento
    const sortVal = sortBy.value;
    if (sortVal === 'nameAsc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortVal === 'nameDesc') {
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    } else if (sortVal === 'priceLow') {
        list.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    } else if (sortVal === 'priceHigh') {
        list.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
    }

    // Actualizar encabezados
    resultsCountEl.textContent = `${list.length} ítems`;
    let typeName = 'Todos los Productos';
    if (currentTypeFilter === 'single') typeName = 'Cartas Singles';
    if (currentTypeFilter === 'sealed') typeName = 'Producto Sellado';
    currentFilterTitle.textContent = currentCategoryFilter ? `${typeName} - ${currentCategoryFilter}` : typeName;

    if (list.length === 0) {
        productsGrid.innerHTML = `
            <div class="loading-spinner-container">
                <i class="fas fa-search" style="font-size: 2.5rem; color: var(--text-muted);"></i>
                <p>No se encontraron productos.</p>
            </div>
        `;
        return;
    }

    // Pintar tarjetas (Optimizadas para visualización táctil doble columna en móvil)
    list.forEach(prod => {
        const stock = parseInt(prod.stock || 0);
        const card = document.createElement('div');
        card.className = 'product-card';

        // Badge de Stock
        let badgeHTML = '';
        if (stock <= 0) {
            badgeHTML = `<span class="stock-badge out">Agotado</span>`;
        } else if (stock <= 3) {
            badgeHTML = `<span class="stock-badge low">Quedan ${stock}</span>`;
        } else {
            badgeHTML = `<span class="stock-badge available">Disponible</span>`;
        }

        const fallbackImg = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=300&auto=format&fit=crop';
        const imgUrl = prod.imageUrl || fallbackImg;
        const setLabel = prod.expansion || prod.set || 'Singles';
        const rarityBadge = prod.rarity ? `<span class="rarity-tag">${prod.rarity}</span>` : '';

        card.innerHTML = `
            ${badgeHTML}
            <div class="card-image-box">
                <img src="${imgUrl}" alt="${prod.name}" onerror="this.src='${fallbackImg}'">
            </div>
            <span class="product-category">${prod.category || 'TCG'}</span>
            <h3 class="product-name" title="${prod.name}">${prod.name}</h3>
            <div class="product-meta">
                <span class="expansion-tag"><i class="fas fa-box-open"></i> ${setLabel}</span>
                ${rarityBadge}
            </div>
            <div class="product-buy-row">
                <div class="price-box">
                    <span class="price-label">Precio</span>
                    <span class="price-value">$${parseFloat(prod.price || 0).toFixed(2)}</span>
                </div>
                ${stock <= 0 ? `
                    <button class="add-cart-btn" disabled><i class="fas fa-ban"></i></button>
                ` : `
                    <div class="qty-controller">
                        <button class="qty-btn" onclick="window.adjustLocalQty('${prod.id}', -1)">-</button>
                        <input type="number" id="qtyInput_${prod.id}" value="1" min="1" max="${stock}" class="qty-input" readonly>
                        <button class="qty-btn" onclick="window.adjustLocalQty('${prod.id}', 1, ${stock})">+</button>
                    </div>
                    <button class="add-cart-btn" onclick="window.triggerAddToCart('${prod.id}')" aria-label="Agregar al carrito"><i class="fas fa-cart-plus"></i></button>
                `}
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

// Ajustar el contador numérico de la propia tarjeta del producto
window.adjustLocalQty = function(id, delta, maxStock) {
    const input = document.getElementById(`qtyInput_${id}`);
    if (!input) return;
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (maxStock && val > maxStock) val = maxStock;
    input.value = val;
};

// Disparar la adición al carrito desde el botón de la tarjeta
window.triggerAddToCart = function(id) {
    const input = document.getElementById(`qtyInput_${id}`);
    const quantity = input ? parseInt(input.value) : 1;
    const item = products.find(p => p.id === id);
    if (!item) return;

    addToCart(item, quantity);
    if (input) input.value = 1; // resetear a 1 tras agregar exitosamente
};

// ==========================================
// 3. GESTIÓN DEL CARRITO
// ==========================================
function addToCart(product, quantity) {
    const existingIndex = cart.findIndex(item => item.id === product.id);
    const stockLimit = parseInt(product.stock || 0);

    if (existingIndex > -1) {
        const potentialQty = cart[existingIndex].quantity + quantity;
        if (potentialQty <= stockLimit) {
            cart[existingIndex].quantity = potentialQty;
            showToast(`${product.name} actualizado en carrito.`, "success");
        } else {
            cart[existingIndex].quantity = stockLimit;
            showToast(`Solo quedan ${stockLimit} unidades disponibles de este producto.`, "warning");
        }
    } else {
        if (quantity <= stockLimit) {
            cart.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price || 0),
                imageUrl: product.imageUrl,
                type: product.type,
                category: product.category,
                quantity: quantity
            });
            showToast(`${product.name} agregado al carrito.`, "success");
        } else {
            showToast(`Stock insuficiente. Quedan ${stockLimit} unidades.`, "warning");
        }
    }

    updateCartUI();
}

window.changeCartQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    const original = products.find(p => p.id === id);
    const maxStock = original ? parseInt(original.stock || 0) : 999;

    const target = item.quantity + delta;
    if (target <= 0) {
        window.removeFromCart(id);
    } else if (target <= maxStock) {
        item.quantity = target;
        updateCartUI();
    } else {
        showToast(`Lo sentimos, no hay más unidades disponibles de este artículo.`, "warning");
    }
};

window.removeFromCart = function(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
    showToast("Producto removido.", "info");
};

// Sincronizar stock del carrito cuando cambie en la BD de Firebase en segundo plano
function syncCartWithDatabase() {
    let modified = false;
    cart.forEach(item => {
        const dbProduct = products.find(p => p.id === item.id);
        if (!dbProduct) {
            // El artículo ya no está en la base de datos
            cart = cart.filter(i => i.id !== item.id);
            modified = true;
        } else {
            const currentStock = parseInt(dbProduct.stock || 0);
            if (item.quantity > currentStock) {
                if (currentStock <= 0) {
                    cart = cart.filter(i => i.id !== item.id);
                } else {
                    item.quantity = currentStock;
                }
                modified = true;
            }
        }
    });

    if (modified) {
        updateCartUI();
        showToast("Tu carrito se ha sincronizado con el stock real disponible.", "info");
    }
}

function updateCartUI() {
    cartItemsContainer.innerHTML = '';
    let totalSum = 0;
    let badgeCount = 0;

    localStorage.setItem('dnd_tcg_cart', JSON.stringify(cart));

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-basket"></i>
                <p>Tu carrito está vacío.</p>
                <span>Agrega cartas o sobres desde el catálogo para iniciar tu pedido.</span>
            </div>
        `;
        cartTotalValue.textContent = '$0.00';
        cartBadge.textContent = '0';
        mobileCartBadge.textContent = '0';
        // Ocultar botón flotante en móvil si el carrito está vacío
        mobileFloatingCartBtn.classList.remove('show');
        return;
    }

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        totalSum += itemTotal;
        badgeCount += item.quantity;

        const row = document.createElement('div');
        row.className = 'cart-item-row';
        
        const fallback = 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=100&auto=format&fit=crop';
        const img = item.imageUrl || fallback;

        row.innerHTML = `
            <div class="cart-item-thumb">
                <img src="${img}" alt="${item.name}" onerror="this.src='${fallback}'">
            </div>
            <div class="cart-item-details">
                <span class="cart-item-category">${item.category}</span>
                <h4 class="cart-item-name">${item.name}</h4>
                <div class="cart-item-price-info">
                    $${item.price.toFixed(2)} x ${item.quantity} = <strong>$${itemTotal.toFixed(2)}</strong>
                </div>
            </div>
            <div class="cart-item-actions">
                <div class="qty-controller">
                    <button class="qty-btn" onclick="window.changeCartQty('${item.id}', -1)">-</button>
                    <span class="qty-input">${item.quantity}</span>
                    <button class="qty-btn" onclick="window.changeCartQty('${item.id}', 1)">+</button>
                </div>
                <button class="cart-item-remove" onclick="window.removeFromCart('${item.id}')">Eliminar</button>
            </div>
        `;
        cartItemsContainer.appendChild(row);
    });

    cartTotalValue.textContent = `$${totalSum.toFixed(2)}`;
    cartBadge.textContent = badgeCount;
    mobileCartBadge.textContent = badgeCount;
    // Mostrar botón flotante en móviles si tiene ítems
    mobileFloatingCartBtn.classList.add('show');
}

// ==========================================
// 4. ENVÍO Y CONFIRMACIÓN DE PEDIDO
// ==========================================
checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (cart.length === 0) {
        showToast("Tu carrito está vacío. Agrega productos para ordenar.", "warning");
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const deliveryType = customerDelivery.value;
    const address = customerAddress.value.trim();

    if (deliveryType === 'shipping' && !address) {
        showToast("La dirección es obligatoria para envíos a domicilio.", "warning");
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitOrder');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fas fa-spinner animate-spin"></i> Procesando pedido...`;

    try {
        let orderTotal = 0;
        let itemsOrdered = [];

        // Transacción segura en Firestore para verificar y restar stock
        await runTransaction(db, async (transaction) => {
            for (const item of cart) {
                // Verificar si es single ('cards') o sellado ('sealedProducts')
                const collName = item.type === 'single' ? 'cards' : 'sealedProducts';
                const docRef = doc(db, collName, item.id);
                
                const snap = await transaction.get(docRef);
                if (!snap.exists()) {
                    throw `El producto "${item.name}" ya no existe en la base de datos.`;
                }

                const currentStock = parseInt(snap.data().stock || 0);
                if (currentStock < item.quantity) {
                    throw `Stock insuficiente para "${item.name}". Quedan ${currentStock} unidades.`;
                }

                // Restar stock
                transaction.update(docRef, { stock: currentStock - item.quantity });

                itemsOrdered.push({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    type: item.type,
                    category: item.category
                });

                orderTotal += item.price * item.quantity;
            }

            // Guardar registro del pedido en una colección para tu panel admin
            const ordersCollection = collection(db, "pedidos");
            await addDoc(ordersCollection, {
                cliente: name,
                telefono: phone,
                metodoEntrega: deliveryType === 'shipping' ? 'Envío' : 'Retiro',
                direccion: deliveryType === 'shipping' ? address : '',
                items: itemsOrdered,
                total: orderTotal,
                fecha: new Date(),
                estado: "Pendiente"
            });
        });

        // Abrir Modal de éxito local
        successModal.classList.add('open');
        closeCart();

        // Construir mensaje detallado de WhatsApp para el comerciante
        let msg = `*NUEVO PEDIDO - DECK & DRIFT TCG*\n\n`;
        msg += `👤 *Cliente:* ${name}\n`;
        msg += `📞 *Teléfono:* ${phone}\n`;
        msg += `📦 *Entrega:* ${deliveryType === 'shipping' ? 'Envío a Domicilio' : 'Retiro en Tienda'}\n`;
        if (deliveryType === 'shipping') {
            msg += `📍 *Dirección:* ${address}\n`;
        }
        msg += `\n🛒 *DETALLE DEL PEDIDO:*\n`;
        
        cart.forEach(item => {
            msg += `- ${item.name} (${item.category}) | x${item.quantity} u. - $${(item.price * item.quantity).toFixed(2)}\n`;
        });
        
        msg += `\n💵 *Total estimado:* $${orderTotal.toFixed(2)}`;

        const cleanPhone = "50375464267"; // Número para recibir el pedido
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;

        // Vaciar carrito
        cart = [];
        updateCartUI();

        // Al hacer clic en listo se redirecciona al chat de whatsapp
        btnSuccessClose.onclick = () => {
            successModal.classList.remove('open');
            window.open(whatsappUrl, '_blank');
        };

    } catch (error) {
        console.error("Error al registrar pedido:", error);
        showToast(error.toString(), "warning");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fab fa-whatsapp"></i> Confirmar y Enviar Pedido`;
    }
});

// Mostrar/Ocultar Dirección según el tipo de entrega
customerDelivery.addEventListener('change', () => {
    if (customerDelivery.value === 'shipping') {
        addressField.classList.remove('hidden');
        customerAddress.required = true;
    } else {
        addressField.classList.add('hidden');
        customerAddress.required = false;
        customerAddress.value = '';
    }
});

// ==========================================
// 5. EVENTOS GENERALES DE LA INTERFAZ
// ==========================================

// Abrir y Cerrar Carrito con Bloqueo de Scroll para pantallas táctiles/celulares
function openCart() {
    cartDrawer.classList.add('open');
    document.body.classList.add('no-scroll');
}

function closeCart() {
    cartDrawer.classList.remove('open');
    document.body.classList.remove('no-scroll');
}

cartBtn.addEventListener('click', openCart);
mobileFloatingCartBtn.addEventListener('click', openCart);
closeCartBtn.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// Filtros de Tipo de Producto
btnAllTypes.addEventListener('click', () => {
    currentTypeFilter = 'all';
    setActiveFilterBtn(btnAllTypes);
    renderProducts();
});

btnSinglesType.addEventListener('click', () => {
    currentTypeFilter = 'single';
    setActiveFilterBtn(btnSinglesType);
    renderProducts();
});

btnSealedType.addEventListener('click', () => {
    currentTypeFilter = 'sealed';
    setActiveFilterBtn(btnSealedType);
    renderProducts();
});

function setActiveFilterBtn(activeBtn) {
    [btnAllTypes, btnSinglesType, btnSealedType].forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

// Escuchar cambios en buscador y criterios de ordenamiento
searchInput.addEventListener('input', renderProducts);
sortBy.addEventListener('change', renderProducts);

// Notificaciones Toast Rápidas
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fas fa-info-circle"></i>';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if (type === 'warning') icon = '<i class="fas fa-exclamation-triangle"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Iniciar aplicación
startApp();
