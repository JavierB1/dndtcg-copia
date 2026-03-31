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
// LÓGICA DE BÚSQUEDA MEJORADA (MANEJO DE SLASH 028/151)
// ==========================================================================

async function handleQuickSearch() {
    let rawInput = searchCardNumberInput.value.trim();
    const setIdInput = searchSetIdInput.value.trim().toLowerCase();

    if (!rawInput) {
        searchStatusMessage.textContent = "Por favor ingresa el número de la carta.";
        searchStatusMessage.style.color = "#ef4444";
        return;
    }

    // LÓGICA INTELIGENTE: Si el usuario pone "028/151", extraemos el 028
    let cardNumber = rawInput;
    let printedTotal = null;
    
    if (rawInput.includes('/')) {
        const parts = rawInput.split('/');
        cardNumber = parts[0].trim();
        printedTotal = parts[1].trim();
    }

    searchStatusMessage.textContent = "Consultando TCGPlayer...";
    searchStatusMessage.style.color = "#3b82f6";
    submitSearchBtn.disabled = true;

    try {
        // Construimos la query protegiendo caracteres especiales
        let queryParts = [`number:"${cardNumber}"`];
        
        if (setIdInput) {
            queryParts.push(`(set.id:"${setIdInput}*" OR set.name:"${setIdInput}*")`);
        }

        const fullQuery = queryParts.join(' ');
        const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(fullQuery)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error("Error en la API");
        
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            let bestMatch = null;

            // Si detectamos un total (ej. /151), filtramos por eso para ser exactos
            if (printedTotal) {
                bestMatch = data.data.find(c => c.set.printedTotal == printedTotal);
            }

            // Si no hay filtro o no encontramos por total, tomamos el primer resultado
            if (!bestMatch) bestMatch = data.data[0];

            fillFormWithAPIData(bestMatch);
            closeModal(quickSearchModal);
            
            searchCardNumberInput.value = "";
            searchSetIdInput.value = "";
            searchStatusMessage.textContent = "";
        } else {
            searchStatusMessage.textContent = "No se encontró la carta. Prueba solo con el número.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        console.error("Error en búsqueda:", error);
        searchStatusMessage.textContent = "Error de conexión con el servidor.";
        searchStatusMessage.style.color = "#ef4444";
    } finally {
        submitSearchBtn.disabled = false;
    }
}

function fillFormWithAPIData(card) {
    openModal(cardModal);
    
    cardName.value = card.name;
    // Guardamos el código completo para tu inventario
    cardCode.value = `${card.number}/${card.set.printedTotal}`;
    cardExpansion.value = card.set.name;
    cardImage.value = card.images.large || card.images.small;
    
    // EXTRACCIÓN DE DATOS TCGPLAYER
    let tcgPrice = 0;
    if (card.tcgplayer && card.tcgplayer.prices) {
        const p = card.tcgplayer.prices;
        const priceOrder = ['holofoil', 'reverseHolofoil', 'normal', 'unlimitedHolofoil'];
        let categoryFound = priceOrder.find(cat => p[cat]);

        if (categoryFound) {
            tcgPrice = p[categoryFound].market || p[categoryFound].mid || p[categoryFound].low || 0;
        } else {
            const anyCat = Object.keys(p)[0];
            if (anyCat) tcgPrice = p[anyCat].market || p[anyCat].mid || 0;
        }
    }
    
    cardPrice.value = parseFloat(tcgPrice).toFixed(2);
    cardCategory.value = 'Pokémon TCG';

    [cardName, cardCode, cardExpansion, cardImage, cardPrice].forEach(f => {
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
    try {
        const cardSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'cards'));
        allCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCardsTable();

        const catSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'categories'));
        allCategories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        cardCategory.innerHTML = '<option value="" disabled selected>Selecciona Juego</option>';
        allCategories.forEach(c => cardCategory.appendChild(new Option(c.name, c.name)));
    } catch (e) {
        console.error("Error cargando datos:", e);
    }
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    allCards.forEach(c => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.id}</td>
            <td><img src="${c.imagen_url}" width="40" style="border-radius:4px" onerror="this.src='https://placehold.co/40x50?text=Err'"></td>
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
    try {
        if (cardId.value) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cards', cardId.value), data);
        } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cards'), data);
        }
        cardForm.reset(); closeModal(cardModal); await loadAllData();
    } catch (err) {
        console.error("Error guardando:", err);
    }
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    sidebarMenu = document.getElementById('sidebar-menu');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    loginModal = document.getElementById('loginModal');
    cardModal = document.getElementById('cardModal');
    quickSearchModal = document.getElementById('scannerModal'); 
    
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardCode = document.getElementById('cardCode');
    cardExpansion = document.getElementById('cardExpansion');
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');

    // Inyectar estilos actualizados
    const style = document.createElement('style');
    style.innerHTML = `
        @media(max-width:768px){.sidebar{position:fixed;left:-260px;z-index:100;transition:0.3s}.sidebar.show{left:0}.main-content{margin-left:0}.admin-modal-content{width:95%}}
        .search-group { margin-bottom: 15px; }
        .search-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #4a5568; font-size: 0.85rem; }
        .search-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem; }
        .btn-search-submit { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: background 0.2s; }
        .btn-search-submit:disabled { background: #cbd5e0; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    const modalContent = quickSearchModal.querySelector('.admin-modal-content');
    if (modalContent) {
        modalContent.innerHTML = `
            <span class="close-button">&times;</span>
            <h2 style="margin-bottom: 20px;"><i class="fas fa-search"></i> Buscador por Código</h2>
            <div class="search-group">
                <label>Número de Carta (ej: 028 o 028/151)</label>
                <input type="text" id="searchCardNumber" class="search-input" placeholder="Escribe el número...">
            </div>
            <div class="search-group">
                <label>Nombre o Código Expansión (ej: mew, 151, obsidian)</label>
                <input type="text" id="searchSetId" class="search-input" placeholder="Opcional pero ayuda mucho...">
            </div>
            <button id="submitSearch" class="btn-search-submit">Buscar Información</button>
            <p id="searchStatus" style="margin-top: 15px; text-align: center; font-size: 0.9rem; min-height: 1.2em;"></p>
        `;
        
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        
        submitSearchBtn.addEventListener('click', handleQuickSearch);
        [searchCardNumberInput, searchSetIdInput].forEach(input => {
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleQuickSearch(); });
        });
    }

    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => { 
        sidebarMenu.classList.add('show'); sidebarOverlay.style.display='block'; 
    });
    sidebarOverlay?.addEventListener('click', () => { 
        sidebarMenu.classList.remove('show'); sidebarOverlay.style.display='none'; 
    });
    
    document.getElementById('nav-cards')?.addEventListener('click', () => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById('cards-section').classList.add('active');
        if(window.innerWidth < 768) { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display='none'; }
    });

    document.getElementById('openScannerBtn')?.addEventListener('click', () => {
        openModal(quickSearchModal);
        searchCardNumberInput.focus();
    });

    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(cardModal); closeModal(quickSearchModal);
    }));

    cardForm?.addEventListener('submit', handleSaveCard);
    document.getElementById('addCardBtn')?.addEventListener('click', () => { 
        cardForm.reset(); cardId.value=''; openModal(cardModal); 
    });

    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            closeModal(loginModal); await loadAllData();
        } catch(err) { alert("Error de acceso"); }
    });

    openModal(loginModal);
});
