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
let ocrWorker = null;
let isScanning = false;
let isProcessingFrame = false;
let mediaStream = null;

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
let sidebarMenu, sidebarOverlay, loginModal, cardModal, scannerModal;
let cardForm, cardId, cardName, cardCode, cardExpansion, cardImage, cardPrice, cardStock, cardCategory;
let scannerStatusMessage, cameraStream, captureCanvas;

// ==========================================================================
// MOTOR DE ESCANEO AUTOMÁTICO (PERSISTENCIA)
// ==========================================================================

async function initOCR() {
    if (!window.Tesseract) {
        await new Promise(r => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = r;
            document.head.appendChild(s);
        });
    }
    if (!ocrWorker) {
        ocrWorker = await Tesseract.createWorker('eng');
    }
}

async function startAutoScanner() {
    try {
        isScanning = true;
        scannerStatusMessage.innerHTML = "Iniciando cámara...";
        
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        cameraStream.srcObject = mediaStream;
        
        await initOCR();
        scannerStatusMessage.innerHTML = "<strong>BUSCANDO CARTA...</strong><br><small>Mantén el número de colección en el centro.</small>";
        
        // Iniciar el bucle de observación
        requestAnimationFrame(autoScanLoop);
    } catch (err) {
        scannerStatusMessage.textContent = "Error de cámara. Verifica permisos en Safari.";
    }
}

async function autoScanLoop() {
    if (!isScanning) return;
    if (isProcessingFrame) {
        requestAnimationFrame(autoScanLoop);
        return;
    }

    isProcessingFrame = true;

    try {
        const ctx = captureCanvas.getContext('2d');
        const vW = cameraStream.videoWidth;
        const vH = cameraStream.videoHeight;

        // --- RECORTE INTELIGENTE (ZOOM DIGITAL) ---
        // Tomamos el 40% central para que el usuario no tenga que acercar tanto el iPad
        const cropW = vW * 0.4;
        const cropH = vH * 0.4;
        const sX = (vW - cropW) / 2;
        const sY = (vH - cropH) / 2;

        captureCanvas.width = 600; // Resolución fija para la IA
        captureCanvas.height = 600;

        // Filtro de pre-procesamiento para lectura nítida
        ctx.filter = 'contrast(1.6) grayscale(1) brightness(1.1)';
        ctx.drawImage(cameraStream, sX, sY, cropW, cropH, 0, 0, 600, 600);
        ctx.filter = 'none';

        const result = await ocrWorker.recognize(captureCanvas);
        const text = result.data.text;

        // Patrón Pokémon: Numero/Total (ej: 152/162)
        const match = text.match(/([a-zA-Z0-9]{1,4})\s*\/\s*(\d{1,3})/);

        if (match) {
            const num = match[1].replace(/^0+/, '');
            const total = match[2];
            
            scannerStatusMessage.innerHTML = `<span style="color:#3b82f6">¡Detectado ${match[0]}!</span><br>Validando...`;
            
            const resp = await fetch(`https://api.pokemontcg.io/v2/cards?q=number:${num}`);
            const json = await resp.json();

            if (json.data && json.data.length > 0) {
                // Buscamos la expansión correcta por el total de cartas impresas
                const card = json.data.find(c => c.set.printedTotal == total) || json.data[0];
                handleFoundCard(card, match[0]);
                return; // Detener bucle
            }
        }
    } catch (e) {
        console.error("Error en frame:", e);
    }

    isProcessingFrame = false;
    // Esperar un poco antes del siguiente intento para no saturar el iPad
    setTimeout(() => requestAnimationFrame(autoScanLoop), 400);
}

function handleFoundCard(card, code) {
    isScanning = false;
    stopCamera();
    closeModal(scannerModal);
    openModal(cardModal);
    
    cardName.value = card.name;
    cardCode.value = code;
    cardExpansion.value = card.set.name;
    cardImage.value = card.images.large || card.images.small;
    
    let price = 0;
    if (card.tcgplayer?.prices) {
        const p = card.tcgplayer.prices;
        price = p[Object.keys(p)[0]].market || 0;
    }
    cardPrice.value = parseFloat(price).toFixed(2);
    cardCategory.value = 'Pokémon TCG';

    [cardName, cardCode, cardExpansion, cardImage].forEach(f => {
        f.style.backgroundColor = '#ecfdf5';
        setTimeout(() => f.style.backgroundColor = '', 2000);
    });
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    isScanning = false;
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
    scannerModal = document.getElementById('scannerModal');
    cardForm = document.getElementById('cardForm');
    cardId = document.getElementById('cardId');
    cardName = document.getElementById('cardName');
    cardCode = document.getElementById('cardCode');
    cardExpansion = document.getElementById('cardExpansion');
    cardImage = document.getElementById('cardImage');
    cardPrice = document.getElementById('cardPrice');
    cardStock = document.getElementById('cardStock');
    cardCategory = document.getElementById('cardCategory');
    cameraStream = document.getElementById('cameraStream');
    captureCanvas = document.getElementById('captureCanvas');
    scannerStatusMessage = document.getElementById('scannerStatusMessage');

    // Eventos
    document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => { sidebarMenu.classList.add('show'); sidebarOverlay.style.display='block'; });
    sidebarOverlay?.addEventListener('click', () => { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display='none'; });
    
    document.getElementById('nav-cards')?.addEventListener('click', () => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.getElementById('cards-section').classList.add('active');
        if(window.innerWidth < 768) { sidebarMenu.classList.remove('show'); sidebarOverlay.style.display='none'; }
    });

    document.getElementById('openScannerBtn')?.addEventListener('click', () => {
        openModal(scannerModal);
        startAutoScanner();
    });

    document.querySelectorAll('.close-button').forEach(b => b.addEventListener('click', () => {
        closeModal(cardModal);
        closeModal(scannerModal);
        stopCamera();
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
