// ==========================================================================
// 1. CONFIGURACIÓN Y SERVICIOS DE FIREBASE
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserSessionPersistence 
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { 
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc 
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = firebaseConfig.projectId;

// ==========================================================================
// 2. CONTROL DE SESIÓN (OBLIGATORIO AL RECARGAR PESTAÑA)
// ==========================================================================
let isForcedLogoutDone = false;
signOut(auth).then(() => {
    isForcedLogoutDone = true;
});

// Variables Globales
let allCards = [], allCategories = [], allSealed = [], allOrders = [];

// Elementos UI
let loginView, adminView, sidebarMenu, sidebarOverlay;
let cardForm, cardModal, quickSearchModal, sealedProductModal, categoryModal;
let searchStatusMessage, searchCardNumberInput, searchSetIdInput, submitSearchBtn;
let cardImagePreview, imagePreviewContainer;

// ==========================================================================
// 3. FUNCIONES DE UI Y MODALES
// ==========================================================================

function openModal(m) { 
    if(m){ 
        m.style.display='flex'; 
        document.body.style.overflow='hidden'; 
    } 
}

function closeModal(m) { 
    if(m){ 
        m.style.display='none'; 
        document.body.style.overflow=''; 
    } 
}

// Función para actualizar la vista previa de la imagen
function refreshPreviewImage(url) {
    if (url && url.trim() !== "" && url.startsWith('http')) {
        cardImagePreview.src = url;
        imagePreviewContainer.classList.add('active');
    } else {
        cardImagePreview.src = "";
        imagePreviewContainer.classList.remove('active');
    }
}

function clearSearchInputs() {
    if (searchCardNumberInput) searchCardNumberInput.value = '';
    if (searchSetIdInput) searchSetIdInput.value = '';
    if (searchStatusMessage) searchStatusMessage.textContent = '';
}

function toggleSidebar(show) {
    if (show) {
        sidebarMenu?.classList.add('show');
        sidebarOverlay?.classList.add('show');
    } else {
        sidebarMenu?.classList.remove('show');
        sidebarOverlay?.classList.remove('show');
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if(target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if(activeLink) activeLink.classList.add('active');

    if(window.innerWidth <= 1024) toggleSidebar(false);
}

// ==========================================================================
// 4. BÚSQUEDA TCGPLAYER
// ==========================================================================

async function handleQuickSearch() {
    let rawInput = searchCardNumberInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();

    if (!rawInput) {
        searchStatusMessage.textContent = "Ingresa el número de carta.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }

    let cardNumber = rawInput.includes('/') ? rawInput.split('/')[0].trim() : rawInput;
    let totalHint = rawInput.includes('/') ? rawInput.split('/')[1].trim() : null;

    searchStatusMessage.textContent = "Buscando en Pokémon API...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        let queryStr = `number:"${cardNumber}"`;
        if (setIdInput) queryStr += ` (set.id:"${setIdInput}*" OR set.name:"${setIdInput}*")`;

        const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(queryStr)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            let card = totalHint ? data.data.find(c => c.set.printedTotal == totalHint) : data.data[0];
            if (!card) card = data.data[0];

            fillCardForm(card);
            clearSearchInputs();
            closeModal(quickSearchModal);
        } else {
            searchStatusMessage.textContent = "No se encontró la carta.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        searchStatusMessage.textContent = "Error de conexión.";
    } finally {
        submitSearchBtn.disabled = false;
    }
}

function fillCardForm(card) {
    openModal(cardModal);
    document.getElementById('cardId').value = '';
    document.getElementById('cardName').value = card.name;
    document.getElementById('cardCode').value = `${card.number}/${card.set.printedTotal}`;
    document.getElementById('cardExpansion').value = card.set.name;
    
    const imageUrl = card.images.large || card.images.small;
    document.getElementById('cardImage').value = imageUrl;
    refreshPreviewImage(imageUrl); // Actualizar vista previa tras búsqueda exitosa
    
    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        const cat = ['holofoil', 'reverseHolofoil', 'normal'].find(t => p[t]);
        price = cat ? (p[cat].market || 0) : 0;
    }
    document.getElementById('cardPrice').value = parseFloat(price).toFixed(2);
    document.getElementById('cardCategory').value = 'Pokémon TCG';
}

// ==========================================================================
// 5. CRUD Y CARGA DE DATOS
// ==========================================================================

async function handleSaveCard(e) {
    e.preventDefault();
    const id = document.getElementById('cardId').value;
    const nombre = document.getElementById('cardName').value.trim();
    
    const duplicado = allCards.find(c => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id !== id);
    if (duplicado) {
        alert("¡Error! Ya existe una carta con el nombre: " + nombre);
        return;
    }

    const data = {
        nombre: nombre,
        codigo: document.getElementById('cardCode').value,
        expansion: document.getElementById('cardExpansion').value,
        imagen_url: document.getElementById('cardImage').value,
        precio: parseFloat(document.getElementById('cardPrice').value),
        stock: parseInt(document.getElementById('cardStock').value),
        categoria: document.getElementById('cardCategory').value
    };

    try {
        if (id) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id), data);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        closeModal(cardModal);
        await loadAllData();
    } catch (err) { console.error("Error:", err); }
}

async function loadAllData() {
    try {
        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const catSelects = [document.getElementById('cardCategory'), document.getElementById('sealedProductCategory')];
        catSelects.forEach(sel => {
            if(sel) {
                sel.innerHTML = '<option value="" disabled selected>Selecciona Categoría</option>';
                allCategories.forEach(c => sel.appendChild(new Option(c.name, c.name)));
            }
        });

        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        const sealedSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sealed_products'));
        allSealed = sealedSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const orderSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
        allOrders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        updateStats();
    } catch (e) { console.error("Error en carga:", e); }
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>${c.expansion || '-'}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td class="action-buttons">
                <button class="action-btn edit" data-id="${c.id}" data-type="card"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" data-id="${c.id}" data-type="card" style="color: #ef4444;"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function updateStats() {
    const elCards = document.getElementById('totalCardsCount');
    if(elCards) elCards.textContent = allCards.length;
    const elOut = document.getElementById('outOfStockCount');
    if(elOut) elOut.textContent = allCards.filter(c => parseInt(c.stock) <= 0).length;
}

// ==========================================================================
// 6. INICIALIZACIÓN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    loginView = document.getElementById('loginModal');
    adminView = document.querySelector('.admin-container');
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    
    cardForm = document.getElementById('cardForm');
    cardModal = document.getElementById('cardModal');
    quickSearchModal = document.getElementById('scannerModal');
    
    // Vista previa
    cardImagePreview = document.getElementById('cardImagePreview');
    imagePreviewContainer = document.getElementById('imagePreviewContainer');

    // NAVEGACIÓN
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); showSection(link.dataset.section); });
    });

    // LOGIN
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        const msg = document.getElementById('loginMessage');
        const btn = document.getElementById('loginBtnSubmit');
        try {
            btn.disabled = true;
            btn.textContent = "Verificando...";
            await setPersistence(auth, browserSessionPersistence);
            await signInWithEmailAndPassword(auth, user, pass);
        } catch (err) {
            btn.disabled = false;
            btn.textContent = "Iniciar Sesión";
            if(msg) { msg.textContent = "Credenciales incorrectas."; msg.style.display = "block"; }
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user && isForcedLogoutDone) {
            loginView.style.setProperty('display', 'none', 'important');
            adminView.style.setProperty('display', 'flex', 'important');
            loadAllData();
        } else {
            adminView.style.setProperty('display', 'none', 'important');
            loginView.style.setProperty('display', 'flex', 'important');
        }
    });

    // Buscador
    const modalContent = document.getElementById('quickSearchContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button" id="closeScannerX">&times;</span>
            <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador TCG</h2>
            <div style="margin-bottom: 16px; text-align: left;">
                <label style="font-weight:700; font-size:0.8rem; color:#475569;">Código de Carta (028/151)</label>
                <input type="text" id="tcgSearchInput" placeholder="Número..." style="width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <div style="margin-bottom: 24px; text-align: left;">
                <label style="font-weight:700; font-size:0.8rem; color:#475569;">Expansión (Ej: 151, sv1)</label>
                <input type="text" id="searchSetId" placeholder="Opcional..." style="width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; margin-top: 6px;">
            </div>
            <button id="submitSearch" style="width: 100%; padding: 16px; background: #3182ce; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">Consultar</button>
            <p id="searchStatus" style="margin-top: 20px; font-size: 0.95rem;"></p>
        `;
        searchCardNumberInput = document.getElementById('tcgSearchInput');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        submitSearchBtn.addEventListener('click', handleQuickSearch);
    }

    // EVENTOS DE TIEMPO REAL PARA VISTA PREVIA
    document.getElementById('cardImage')?.addEventListener('input', (e) => {
        refreshPreviewImage(e.target.value);
    });

    // CRUD
    cardForm?.addEventListener('submit', handleSaveCard);
    document.getElementById('addCardBtn')?.addEventListener('click', () => { 
        cardForm.reset(); 
        document.getElementById('cardId').value = ''; 
        refreshPreviewImage(""); // Limpiar vista previa
        openModal(cardModal); 
    });
    document.getElementById('openScannerBtn')?.addEventListener('click', () => openModal(quickSearchModal));
    document.getElementById('refreshAdminPageBtn')?.addEventListener('click', () => location.reload());

    // DELEGACIÓN
    document.body.addEventListener('click', async (e) => {
        if (e.target.classList.contains('close-button')) {
            const modal = e.target.closest('.admin-modal');
            closeModal(modal);
            if(modal.id === 'scannerModal') clearSearchInputs();
            return;
        }

        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        const type = btn.dataset.type;

        if (btn.classList.contains('edit') && type === 'card') {
            const d = allCards.find(x => x.id === id);
            if(!d) return;
            document.getElementById('cardId').value = d.id;
            document.getElementById('cardName').value = d.nombre;
            document.getElementById('cardCode').value = d.codigo;
            document.getElementById('cardExpansion').value = d.expansion || '';
            document.getElementById('cardImage').value = d.imagen_url;
            refreshPreviewImage(d.imagen_url); // Actualizar vista previa al editar
            document.getElementById('cardPrice').value = d.precio;
            document.getElementById('cardStock').value = d.stock;
            document.getElementById('cardCategory').value = d.categoria;
            openModal(cardModal);
        }

        if (btn.classList.contains('delete')) {
            if (!confirm("¿Seguro que deseas eliminar este elemento?")) return;
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', id));
                await loadAllData();
            } catch (err) { alert("Error al eliminar."); }
        }
    });

    document.getElementById('nav-logout-btn')?.addEventListener('click', () => { signOut(auth).then(() => location.reload()); });
});
