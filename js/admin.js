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
// LÓGICA DE BÚSQUEDA POR TEXTO (MEJORADA)
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
        // Query optimizada para la API de Pokémon TCG
        // Usamos comillas para asegurar que el número sea exacto
        let query = `number:"${number}"`;
        
        if (setId) {
            // Buscamos por ID de set exacto o por el nombre del set
            query += ` (set.id:"${setId}" OR set.name:"${setId}*")`;
        }

        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${query}`);
        if (!response.ok) throw new Error("Error en la respuesta de la API");
        
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            // Intentamos encontrar la mejor coincidencia si hay varios resultados
            let bestMatch = data.data[0];
            
            if (setId) {
                const exactMatch = data.data.find(c => 
                    c.set.id.toLowerCase() === setId || 
                    c.set.name.toLowerCase().includes(setId)
                );
                if (exactMatch) bestMatch = exactMatch;
            }

            fillFormWithAPIData(bestMatch, `${bestMatch.number}/${bestMatch.set.printedTotal}`);
            closeModal(quickSearchModal);
            
            // Limpiar buscador
            searchCardNumberInput.value = "";
            searchSetIdInput.value = "";
            searchStatusMessage.textContent = "";
        } else {
            searchStatusMessage.textContent = "No se encontró nada. Intenta solo con el número.";
            searchStatusMessage.style.color = "#ef4444";
        }
    } catch (error) {
        console.error("Error en búsqueda:", error);
        searchStatusMessage.textContent = "Hubo un problema al conectar con la API.";
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
    
    // Extracción robusta de precios (TCGPlayer maneja varios tipos como holofoil, normal, etc)
    let price = 0;
    if (card.tcgplayer && card.tcgplayer.prices) {
        const p = card.tcgplayer.prices;
        // Buscamos el primer precio disponible (market o mid)
        const categories = Object.keys(p);
        if (categories.length > 0) {
            const firstCat = p[categories[0]];
            price = firstCat.market || firstCat.mid || firstCat.low || 0;
        }
    }
    
    cardPrice.value = parseFloat(price).toFixed(2);
    cardCategory.value = 'Pokémon TCG';

    // Animación visual de campos autocompletados
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

    // Estilos CSS inyectados para el buscador
    const style = document.createElement('style');
    style.innerHTML = `
        @media(max-width:768px){.sidebar{position:fixed;left:-260px;z-index:100;transition:0.3s}.sidebar.show{left:0}.main-content{margin-left:0}.admin-modal-content{width:95%}}
        .search-group { margin-bottom: 15px; }
        .search-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #4a5568; font-size: 0.85rem; }
        .search-input { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem; }
        .btn-search-submit { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: background 0.2s; }
        .btn-search-submit:hover { background: #2563eb; }
        .btn-search-submit:disabled { background: #cbd5e0; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    // Reconfiguración del modal para búsqueda manual
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
                <label>Código o Nombre de Expansión (ej: sv1, silver tempest)</label>
                <input type="text" id="searchSetId" class="search-input" placeholder="Ej: sv1">
            </div>
            <button id="submitSearch" class="btn-search-submit">Buscar Información</button>
            <p id="searchStatus" style="margin-top: 15px; text-align: center; font-size: 0.9rem; min-height: 1.2em;"></p>
        `;
        
        searchCardNumberInput = document.getElementById('searchCardNumber');
        searchSetIdInput = document.getElementById('searchSetId');
        submitSearchBtn = document.getElementById('submitSearch');
        searchStatusMessage = document.getElementById('searchStatus');
        
        submitSearchBtn.addEventListener('click', handleQuickSearch);

        // Permitir buscar presionando "Enter"
        [searchCardNumberInput, searchSetIdInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleQuickSearch();
            });
        });
    }

    // Eventos de Interfaz
    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => { 
        sidebarMenu.classList.add('show'); 
        sidebarOverlay.style.display='block'; 
    });
    
    sidebarOverlay?.addEventListener('click', () => { 
        sidebarMenu.classList.remove('show'); 
        sidebarOverlay.style.display='none'; 
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
        closeModal(cardModal);
        closeModal(quickSearchModal);
    }));

    cardForm?.addEventListener('submit', handleSaveCard);
    
    document.getElementById('addCardBtn')?.addEventListener('click', () => { 
        cardForm.reset(); 
        cardId.value=''; 
        openModal(cardModal); 
    });

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
