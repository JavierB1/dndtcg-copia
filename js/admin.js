// ==========================================================================
// GLOBAL VARIABLES (Firebase & Logic)
// ==========================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

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

let allCards = [], allSealedProducts = [], allCategories = [], allOrders = [];

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
let sidebarMenu, sidebarOverlay, loginModal, cardModal, quickSearchModal;
let cardForm, cardId, cardName, cardCode, cardExpansion, cardImage, cardPrice, cardStock, cardCategory;
let searchStatusMessage, searchCardNumberInput, searchSetIdInput, submitSearchBtn;

// ==========================================================================
// LÓGICA DE BÚSQUEDA POR TEXTO (REEMPLAZA A LA CÁMARA)
// ==========================================================================

async function handleQuickSearch() {
    const number = searchCardNumberInput.value.trim();
    const setId = searchSetIdInput.value.trim().toLowerCase();

    if (!number) {
        searchStatusMessage.textContent = "Por favor ingresa el número de la carta.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }

    searchStatusMessage.textContent = "Buscando en la base de datos oficial...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        // Query básica por número
        let query = `number:${number}`;
        // Si el usuario provee las 3 letras de la expansión, filtramos por set.id o set.symbol
        if (setId) {
            query += ` (set.id:${setId}* OR set.symbol:${setId}*)`;
        }

        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${query}`);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            let bestMatch = data.data[0];
            
            // Si hay varios resultados y pusimos expansión, intentamos ser más específicos
            if (setId) {
                const filtered = data.data.find(c => c.set.id.toLowerCase().includes(setId));
                if (filtered) bestMatch = filtered;
            }

            fillFormWithAPIData(bestMatch, `${number}/${bestMatch.set.printedTotal}`);
            closeModal(quickSearchModal);
            
            // Limpiar buscador
            searchCardNumberInput.value = "";
            searchSetIdInput.value = "";
            searchStatusMessage.textContent = "";
        } else {
            searchStatusMessage.textContent = "No se encontró ninguna carta con esos datos.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        console.error("Error en búsqueda:", error);
        searchStatusMessage.textContent = "Error de conexión con la API.";
        searchStatusMessage.style.color = "#ef4444";
    } finally {
        submitSearchBtn.disabled = false;
    }
}

function fillFormWithAPIData(card, displayCode) {
    openModal(cardModal);
    
    cardName.value = card.name;
    cardCode.value = displayCode || card.number;
    cardExpansion.value = card.set.name;
    cardImage.value = card.images.large || card.images.small;
    
    // Obtener precio de mercado sugerido
    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        const firstKey = Object.keys(p)[0];
        price = p[firstKey].market || p[firstKey].mid || 0;
    }
    cardPrice.value = parseFloat(price).toFixed(2);
    cardCategory.value = 'Pokémon TCG';

    // Animación visual de campos autocompletados
    [cardName, cardCode, cardExpansion, cardImage].forEach(f => {
        f.style.backgroundColor = '#ecfdf5';
        setTimeout(() => f.style.backgroundColor = '', 2000);
    });
}

// ==========================================================================
// CORE ADMIN LOGIC (Modals, Auth, CRUD)
// ==========================================================================

function openModal(m) { if(m){ m.style.display='flex'; document.body.style.overflow='hidden'; } }
function closeModal(m) { if(m){ m.style.display='none'; document.body.style.overflow=''; } }

async function loadAllData() {
    const cardSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/cards`));
    allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCardsTable();

    const catSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/categories`));
    allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    cardCategory.innerHTML = '<option value="" disabled selected>Selecciona Juego</option>';
    allCategories.forEach(c => cardCategory.appendChild(new Option(c.name, c.name)));
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id}</td>
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px"></td>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.codigo}</td>
            <td>$${parseFloat(c.precio).toFixed(2)}</td>
            <td>${c.stock}</td>
            <td>${c.categoria}</td>
            <td class="action-buttons">
                <button class="action-btn edit" onclick="editCard('${c.id}')"><i class="fas fa-edit"></i></button>
            </td>
        `;
    });
}

window.editCard = (id) => {
    const c = allCards.find(card => card.id === id);
    if(c) {
        cardId.value = c.id;
        cardName.value = c.nombre;
        cardCode.value = c.codigo;
        cardExpansion.value = c.expansion;
        cardImage.value = c.imagen_url;
        cardPrice.value = c.precio;
        cardStock.value = c.stock;
        cardCategory.value = c.categoria;
        openModal(cardModal);
    }
};

async function handleSaveCard(e) {
    e.preventDefault();
    const data = {
        nombre: cardName.value, codigo: cardCode.value, expansion: cardExpansion.value,
        imagen_url: cardImage.value, precio: cardPrice.value, stock: cardStock.value, categoria: cardCategory.value
    };
    if (cardId.value) await updateDoc(doc(db, `artifacts/${appId}/public/data/cards`, cardId.value), data);
    else await addDoc(collection(db, `artifacts/${appId}/public/data/cards`), data);
    cardForm.reset(); closeModal(cardModal); await loadAllData();
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    loginModal = document.getElementById('loginModal');
    cardModal = document.getElementById('cardModal');
    quickSearchModal = document.getElementById('scannerModal'); // Reutilizamos el contenedor del modal
    
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardCode = document.getElementById('cardCode');
    cardExpansion = document.getElementById('cardExpansion');
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');

    // Estilos para el buscador manual
    const style = document.createElement('style');
    style.innerHTML = `
        @media(max-width:768px){.sidebar{position:fixed;left:-260px;z-index:100;transition:0.3s}.sidebar.show{left:0}.main-content{margin-left:0}.admin-modal-content{width:95%}}
        .search-group { margin-bottom: 15px; }
        .search-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #4a5568; font-size: 0.85rem; }
        .search-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem; }
        .btn-search-submit { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .btn-search-submit:disabled { background: #cbd5e0; }
    `;
    document.head.appendChild(style);

    // Transformar el modal de "Escáner" en "Buscador de Texto"
    const modalContent = quickSearchModal.querySelector('.admin-modal-content');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador de Cartas</h2>
            <div class="search-group">
                <label>Número de Carta (ej: 152)</label>
                <input type="text" id="searchCardNumber" class="search-input" placeholder="Ej: 152">
            </div>
            <div class="search-group">
                <label>Código Expansión (ej: sv1, pgo, swsh12)</label>
                <input type="text" id="searchSetId" class="search-input" placeholder="Ej: sv1">
            </div>
            <button id="submitSearch" class="btn-search-submit">Buscar en API</button>
            <p id="searchStatus" style="margin-top: 15px; text-align: center; font-size: 0.9rem;"></p>
        `;
        
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        
        submitSearchBtn.addEventListener('click', handleQuickSearch);
    }

    // Eventos de Navegación
    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => { sidebarMenu.classList.add('show'); sidebarOverlay.style.display='block'; });
    sidebarOverlay?.addEventListener('click', () => { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display='none'; });
    
    document.getElementById('nav-cards')?.addEventListener('click', () => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById('cards-section').classList.add('active');
        if(window.innerWidth < 768) { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display='none'; }
    });

    document.getElementById('openScannerBtn')?.addEventListener('click', () => {
        openModal(quickSearchModal);
    });

    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(cardModal);
        closeModal(quickSearchModal);
    }));

    cardForm?.addEventListener('submit', handleSaveCard);
    document.getElementById('addCardBtn')?.addEventListener('click', () => { cardForm.reset(); cardId.value=''; openModal(cardModal); });

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            closeModal(loginModal);
            await loadAllData();
        } catch(err) { alert("Error de acceso"); }
    });

    openModal(loginModal);
});
