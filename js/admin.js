 // ==========================================================================
// GLOBAL VARIABLES (non-DOM related)
// ==========================================================================

// Firebase and Firestore SDK imports
import { initializeApp }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, getDoc }
from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

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

// Gemini API Key (inyectada por el entorno)
const apiKey = ""; 

// Inicializa los servicios de Firebase
let app;
let db;
let auth;
if (firebaseConfig && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} else {
    console.error("Error: firebaseConfig no está disponible.");
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

// --- NUEVAS VARIABLES PARA ESCÁNER ---
let cameraStream = null;

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
let sidebarToggleBtn, closeSidebarBtn, sidebarMenu, sidebarOverlay, mainHeader;
let loginModal, loginForm, loginMessage, usernameInput, passwordInput;

let navDashboard, navCards, navSealedProducts, navCategories, navOrders, navLogout, navScanner;
let dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection;

let addCardBtn, cardModal, cardModalTitle, cardForm, cardId, cardName, cardImage, cardPrice, cardStock, cardCategory, cardSetCode, saveCardBtn;
let cardsTable, messageModal, messageModalTitle, messageModalText;

// --- NUEVAS REFERENCIAS ESCÁNER ---
let videoPreview, startScanBtn, navScannerQuick;

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function showSection(sectionToShow) {
    // Si no hay usuario y no es el login, no mostrar nada
    if (!currentAdminUser) {
        hideAllSections();
        openModal(loginModal);
        return;
    }

    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection];
    sections.forEach(section => {
        if (section) section.classList.remove('active');
    });
    
    if (sectionToShow) {
        sectionToShow.classList.add('active');
    }

    // Si salimos del escáner, apagamos la cámara
    if (sectionToShow !== scannerSection) {
        stopCamera();
    }
}

function hideAllSections() {
    const sections = [dashboardSection, cardsSection, sealedProductsSection, categoriesSection, ordersSection, scannerSection];
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
// AI SCANNER FUNCTIONS
// ==========================================================================

async function startCamera() {
    if (!currentAdminUser) return openModal(loginModal);

    try {
        const constraints = { 
            video: { 
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoPreview) {
            videoPreview.srcObject = cameraStream;
            showSection(scannerSection);
        }
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        showMessageModal("Error de Cámara", "No se pudo acceder a la cámara. Verifica los permisos.");
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        if (videoPreview) videoPreview.srcObject = null;
    }
}

async function handleScanAndIdentify() {
    if (!videoPreview || !cameraStream) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoPreview.videoWidth;
    canvas.height = videoPreview.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoPreview, 0, 0);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    startScanBtn.disabled = true;
    startScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';

    try {
        const result = await analyzeCardWithIA(base64Image);
        
        if (result && (result.nombre || result.name)) {
            stopCamera();
            showSection(cardsSection);
            
            cardId.value = ''; 
            cardForm.reset();
            cardModalTitle.textContent = "Añadir Carta (IA)";
            
            cardName.value = result.nombre || result.name || '';
            if (cardSetCode) cardSetCode.value = result.codigo_set || result.set_code || '';
            
            if (result.categoria || result.category) {
                const cat = (result.categoria || result.category).toLowerCase();
                const options = Array.from(cardCategory.options);
                const found = options.find(o => o.value.toLowerCase().includes(cat));
                if (found) cardCategory.value = found.value;
            }
            
            openModal(cardModal);
        }
    } catch (error) {
        showMessageModal("Aviso", "No se pudo identificar. Intenta de nuevo.");
    } finally {
        startScanBtn.disabled = false;
        startScanBtn.innerHTML = '<i class="fas fa-bullseye"></i> Capturar e Identificar';
    }
}

async function analyzeCardWithIA(base64Data) {
    const prompt = "Identifica esta carta de TCG. Devuelve JSON: {nombre, codigo_set, categoria}.";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                ]
            }],
            generationConfig: { responseMimeType: "application/json" }
        })
    });

    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

// ==========================================================================
// FIREBASE AUTHENTICATION FUNCTIONS
// ==========================================================================

async function handleLogin(event) {
    event.preventDefault();
    const email = usernameInput.value;
    const password = passwordInput.value;
    clearLoginError();

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // El onAuthStateChanged se encargará del resto
    } catch (error) {
        showLoginError('Usuario o contraseña incorrectos.');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.reload(); // Recarga para limpiar todo el estado
    } catch (error) {
        console.error('Error logout:', error);
    }
}

// ==========================================================================
// DATA LOADING FUNCTIONS
// ==========================================================================

async function loadAllData() {
    if (!db) return;
    try {
        // Cargar Categorías
        const catCol = collection(db, `artifacts/${appId}/public/data/categories`);
        const catSnap = await getDocs(catCol);
        allCategories = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Poblar selects
        if (cardCategory) {
            cardCategory.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
            allCategories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                cardCategory.appendChild(opt);
            });
        }

        // Cargar Cartas
        const cardsCol = collection(db, `artifacts/${appId}/public/data/cards`);
        const cardsSnap = await getDocs(cardsCol);
        allCards = cardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderCardsTable();
        updateDashboardStats();
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

function renderCardsTable() {
    if (!cardsTable) return;
    const tbody = cardsTable.querySelector('tbody');
    const searchTerm = (adminSearchInput?.value || '').toLowerCase();
    const filtered = allCards.filter(c => c.nombre.toLowerCase().includes(searchTerm));
    
    tbody.innerHTML = filtered.map(card => `
        <tr>
            <td>${card.id.substring(0,5)}...</td>
            <td><img src="${card.imagen_url}" width="40" onerror="this.src='https://placehold.co/40x50'"></td>
            <td>${card.nombre}</td>
            <td>${card.codigo_set || 'N/A'}</td>
            <td>$${parseFloat(card.precio || 0).toFixed(2)}</td>
            <td>${card.stock || 0}</td>
            <td>
                <button class="edit-button"><i class="fas fa-edit"></i></button>
            </td>
        </tr>
    `).join('');
}

function updateDashboardStats() {
    if (totalCardsCount) totalCardsCount.textContent = allCards.length;
    if (uniqueCategoriesCount) uniqueCategoriesCount.textContent = allCategories.length;
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Referencias
    loginModal = document.getElementById('loginModal');
    loginForm = document.getElementById('loginForm');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');
    loginMessage = document.getElementById('loginMessage');

    navDashboard = document.getElementById('nav-dashboard');
    navCards = document.getElementById('nav-cards');
    navScanner = document.getElementById('nav-scanner');
    navScannerQuick = document.getElementById('nav-scanner-quick');
    navLogout = document.getElementById('nav-logout');

    dashboardSection = document.getElementById('dashboard-section');
    cardsSection = document.getElementById('cards-section');
    scannerSection = document.getElementById('scanner-section');

    videoPreview = document.getElementById('video-preview');
    startScanBtn = document.getElementById('startScanBtn');
    
    cardModal = document.getElementById('cardModal');
    cardForm = document.getElementById('cardForm');
    cardName = document.getElementById('cardName');
    cardId = document.getElementById('cardId');
    cardCategory = document.getElementById('cardCategory');
    cardSetCode = document.getElementById('cardSetCode');

    totalCardsCount = document.getElementById('totalCardsCount');
    uniqueCategoriesCount = document.getElementById('uniqueCategoriesCount');

    // Botones de cierre de modales
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(cardModal);
            closeModal(loginModal);
        });
    });

    // Listeners Navegación
    navDashboard?.addEventListener('click', (e) => { e.preventDefault(); showSection(dashboardSection); });
    navCards?.addEventListener('click', (e) => { e.preventDefault(); showSection(cardsSection); });
    navScanner?.addEventListener('click', (e) => { e.preventDefault(); startCamera(); });
    navScannerQuick?.addEventListener('click', (e) => { e.preventDefault(); startCamera(); });
    navLogout?.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });

    loginForm?.addEventListener('submit', handleLogin);
    startScanBtn?.addEventListener('click', handleScanAndIdentify);

    // Auth Observer
    onAuthStateChanged(auth, (user) => {
        currentAdminUser = user;
        if (user) {
            closeModal(loginModal);
            showSection(dashboardSection);
            loadAllData();
        } else {
            hideAllSections();
            openModal(loginModal);
        }
    });
});
