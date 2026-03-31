// ==========================================================================
// GLOBAL VARIABLES & FIREBASE SETUP
// ==========================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDjRTOnQ4d9-4l_W-EwRbYNQ8xkTLKbwsM",
    authDomain: "dndtcgadmin.firebaseapp.com",
    projectId: "dndtcgadmin",
    storageBucket: "dndtcgadmin.firebasestorage.app",
    messagingSenderId: "754642671504",
    appId: "1:754642671504:web:c087cc703862cf8c228515",
    measurementId: "G-T8KRZX5S7R"
};

let app, db, auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

const appId = firebaseConfig.projectId;
let stream = null; 

let allCards = [];
let allSealedProducts = [];
let allCategories = [];
let allOrders = [];

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let loginModal, loginForm, usernameInput, passwordInput;
let navDashboard, navCards, navScanner, navLogout;
let dashboardSection, cardsSection, scannerSection;
let cardModal, cardForm, cardId, cardName, cardImage, cardPrice, cardStock, cardCategory, cardSetCode;
let videoPreview, startScanBtn, processingIndicator, addCardBtn, navScannerQuick;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    const sections = [dashboardSection, cardsSection, scannerSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
    if (sectionToShow) {
        sectionToShow.classList.add('active');
        sectionToShow.style.display = 'block';
    }
    // Ocultar las otras manualmente si no usas clases CSS para el display
    sections.forEach(section => {
        if (section && section !== sectionToShow) section.style.display = 'none';
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

function showMessageModal(title, text) {
    // Asumiendo que existe el modal de mensajes en el HTML
    const titleEl = document.getElementById('messageModalTitle');
    const textEl = document.getElementById('messageModalText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    const modal = document.getElementById('messageModal');
    if (modal) openModal(modal);
    else alert(`${title}: ${text}`);
}

// ==========================================================================
// CAMERA & SCANNER LOGIC
// ==========================================================================

async function startCamera() {
    if (!videoPreview) return;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        videoPreview.srcObject = stream;
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        showMessageModal("Error de Cámara", "No se pudo acceder a la cámara. Revisa los permisos.");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function handleScan() {
    if (!startScanBtn || !processingIndicator) return;

    processingIndicator.style.display = 'block';
    startScanBtn.disabled = true;

    // Simulación de OCR / Reconocimiento Inteligente
    setTimeout(() => {
        processingIndicator.style.display = 'none';
        startScanBtn.disabled = false;

        const foundCard = {
            nombre: "Mewtwo VSTAR",
            set: "GG44/GG70",
            precio: 85.50,
            imagen_url: "https://images.pokemontcg.io/swsh12tg/TG22_hires.png",
            categoria: allCategories.length > 0 ? allCategories[0].name : "Pokémon",
            stock: 1
        };

        stopCamera();

        // Rellenar el formulario con los datos detectados
        document.getElementById('cardModalTitle').textContent = "Carta Identificada";
        cardId.value = '';
        cardName.value = foundCard.nombre;
        cardSetCode.value = foundCard.set; // Campo de código de set
        cardImage.value = foundCard.imagen_url;
        cardPrice.value = foundCard.precio;
        cardStock.value = foundCard.stock;
        cardCategory.value = foundCard.categoria;
        
        showSection(cardsSection);
        openModal(cardModal);
    }, 2000);
}

// ==========================================================================
// FIREBASE AUTHENTICATION
// ==========================================================================

async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput.value;
    const password = passwordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal(loginModal);
        showSection(dashboardSection);
        await loadAllData();
    } catch (error) {
        console.error('Error Login:', error);
        const msg = document.getElementById('loginMessage');
        if (msg) {
            msg.textContent = "Credenciales incorrectas.";
            msg.style.display = 'block';
        }
    }
}

// ==========================================================================
// DATA LOADING
// ==========================================================================

async function loadAllData() {
    await loadCategories();
    await loadCardsData();
    // await loadSealedProductsData(); // Opcional según tu flujo
}

async function loadCategories() {
    try {
        const colRef = collection(db, `artifacts/${appId}/public/data/categories`);
        const snap = await getDocs(colRef);
        allCategories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        populateFilters();
    } catch (e) { console.error(e); }
}

async function loadCardsData() {
    try {
        const colRef = collection(db, `artifacts/${appId}/public/data/cards`);
        const snap = await getDocs(colRef);
        allCards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCardsTable();
        updateStats();
    } catch (e) { console.error(e); }
}

// ==========================================================================
// RENDERING & UI UPDATES
// ==========================================================================

function populateFilters() {
    const cats = allCategories.map(c => c.name);
    if (cardCategory) {
        cardCategory.innerHTML = '<option value="" disabled selected>Seleccionar</option>' + 
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

function renderCardsTable() {
    const tbody = document.querySelector('#cardsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = allCards.map(card => `
        <tr>
            <td>${card.id.substring(0,5)}...</td>
            <td><img src="${card.imagen_url}" width="40" style="border-radius:4px;"></td>
            <td>${card.nombre}</td>
            <td>${card.set_code || '---'}</td>
            <td>$${parseFloat(card.precio).toFixed(2)}</td>
            <td>${card.stock}</td>
            <td class="action-buttons">
                <button class="edit-button" onclick="window.editCard('${card.id}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateStats() {
    const countEl = document.getElementById('totalCardsCount');
    if (countEl) countEl.textContent = allCards.length;
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    
    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    scannerSection = document.getElementById('scanner-section');
    
    navDashboard = document.getElementById('nav-dashboard');
    navCards = document.getElementById('nav-cards');
    navScanner = document.getElementById('nav-scanner');
    navScannerQuick = document.getElementById('nav-scanner-quick');

    videoPreview = document.getElementById('video-preview');
    startScanBtn = document.getElementById('startScanBtn');
    processingIndicator = document.getElementById('processing-indicator');

    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardSetCode = document.getElementById('cardSetCode'); // Referencia al nuevo campo
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');
    addCardBtn = document.getElementById('addCardBtn');

    // Eventos de Navegación
    if (navDashboard) navDashboard.addEventListener('click', () => { showSection(dashboardSection); stopCamera(); });
    if (navCards) navCards.addEventListener('click', () => { showSection(cardsSection); stopCamera(); });
    if (navScanner) navScanner.addEventListener('click', () => { showSection(scannerSection); startCamera(); });
    if (navScannerQuick) navScannerQuick.addEventListener('click', () => { showSection(scannerSection); startCamera(); });

    // Evento Añadir Manual (Botón Verde +)
    if (addCardBtn) {
        addCardBtn.addEventListener('click', () => {
            document.getElementById('cardModalTitle').textContent = "Añadir Nueva Carta";
            cardId.value = '';
            cardForm.reset();
            openModal(cardModal);
        });
    }

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (startScanBtn) startScanBtn.addEventListener('click', handleScan);

    // Cerrar Modal
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(cardModal);
            closeModal(loginModal);
        });
    });

    // Logout
    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await signOut(auth);
        location.reload();
    });

    // Verificar estado de sesión inicial
    onAuthStateChanged(auth, (user) => {
        if (user) {
            closeModal(loginModal);
            showSection(dashboardSection);
            loadAllData();
        } else {
            openModal(loginModal);
        }
    });
});

// Helpers Globales
window.editCard = (id) => {
    const card = allCards.find(c => c.id === id);
    if (card) {
        cardId.value = card.id;
        cardName.value = card.nombre;
        cardSetCode.value = card.set_code || '';
        cardImage.value = card.imagen_url;
        cardPrice.value = card.precio;
        cardStock.value = card.stock;
        cardCategory.value = card.categoria;
        document.getElementById('cardModalTitle').textContent = "Editar Carta";
        openModal(cardModal);
    }
};

window.closeModal = closeModal;
