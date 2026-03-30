// netlify/functions/manage-sheetdb.js

// Accede a las variables de entorno de Netlify
// ¡IMPORTANTE! Configura estas variables en el panel de Netlify (Site settings > Build & deploy > Environment)
// Por ejemplo:
// SHEETDB_CARDS_URL = https://sheetdb.io/api/v1/TU_ID_DE_TU_HOJA_DE_CARTAS
// SHEETDB_SEALED_PRODUCTS_URL = https://sheetdb.io/api/v1/TU_ID_DE_TU_HOJA_DE_PRODUCTOS_SELLADOS
// ADMIN_PASSWORD = TU_CONTRASEÑA_SEGURA_PARA_EL_ADMIN

const SHEETDB_CONFIG = {
    cards_url: process.env.SHEETDB_CARDS_URL,
    sealed_products_url: process.env.SHEETDB_SEALED_PRODUCTS_URL,
};
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * Función de autenticación básica.
 * En producción, esto DEBE ser reemplazado por un sistema de autenticación robusto (ej. Firebase Auth).
 * @param {string} password - La contraseña proporcionada por el cliente.
 * @returns {boolean} - True si la contraseña es correcta, false en caso contrario.
 */
function authenticateAdmin(password) {
    return password === ADMIN_PASSWORD;
}

exports.handler = async (event, context) => {
    // Configura CORS
    const headers = {
        'Access-Control-Allow-Origin': '*', // Reemplaza '*' con el dominio de tu Netlify en producción (ej. https://tudominio.netlify.app)
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
        'Content-Type': 'application/json'
    };

    // --- INICIO DE LOGS PARA DEPURACIÓN ---
    console.log('--- Netlify Function Invoked ---');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    console.log('Body:', event.body);
    // --- FIN DE LOGS PARA DEPURACIÓN ---

    // Manejar pre-vuelos OPTIONS para CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: headers,
            body: ''
        };
    }

    // Autenticación del administrador
    const adminPassword = event.headers['x-admin-password'];
    if (!authenticateAdmin(adminPassword)) {
        console.warn('Intento de acceso no autorizado a manage-sheetdb function');
        return {
            statusCode: 401,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'No autorizado. Se requiere contraseña de administrador.' })
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        console.error('Error al parsear el cuerpo de la petición JSON:', e);
        console.error('Cuerpo de la petición recibido:', event.body);
        return {
            statusCode: 400,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Formato de JSON inválido.' })
        };
    }

    const { action, data, id, entityType } = body; // 'action', 'data', 'id', 'entityType'

    let targetUrl = '';
    if (entityType === 'cards') {
        targetUrl = SHEETDB_CONFIG.cards_url;
    } else if (entityType === 'sealedProducts') {
        targetUrl = SHEETDB_CONFIG.sealed_products_url;
    } else {
        // Si la entidad no es 'cards' ni 'sealedProducts', es un tipo no válido para esta función.
        // Las categorías se gestionan directamente con Firestore desde admin.js.
        return {
            statusCode: 400,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Tipo de entidad no válido para esta función. Las categorías se gestionan vía Firestore.' })
        };
    }

    if (!targetUrl) {
        console.error(`URL de SheetDB no configurada para ${entityType}.`);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Error de configuración del servidor: URL de SheetDB no definida.' })
        };
    }

    let sheetdbResponse;
    try {
        switch (action) {
            case 'add':
                sheetdbResponse = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: data })
                });
                break;
            case 'update':
                if (!id) {
                    return {
                        statusCode: 400,
                        headers: headers,
                        body: JSON.stringify({ success: false, message: 'ID requerido para actualizar.' })
                    };
                }
                // Asume que el ID de la carta es 'id', el de producto sellado es 'id_producto'
                let id_field = 'id'; // Por defecto para cartas
                if (entityType === 'sealedProducts') {
                    id_field = 'id_producto';
                }
                sheetdbResponse = await fetch(`${targetUrl}/${id_field}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: data })
                });
                break;
            case 'delete':
                if (!id) {
                    return {
                        statusCode: 400,
                        headers: headers,
                        body: JSON.stringify({ success: false, message: 'ID requerido para eliminar.' })
                    };
                }
                let delete_id_field = 'id'; // Por defecto para cartas
                if (entityType === 'sealedProducts') {
                    delete_id_field = 'id_producto';
                }
                sheetdbResponse = await fetch(`${targetUrl}/${delete_id_field}/${id}`, {
                    method: 'DELETE'
                });
                break;
            default:
                return {
                    statusCode: 400,
                    headers: headers,
                    body: JSON.stringify({ success: false, message: 'Acción no válida.' })
                };
        }

        const result = await sheetdbResponse.json();
        if (!sheetdbResponse.ok) {
            console.error(`Error de SheetDB para ${action} ${entityType}:`, result);
            return {
                statusCode: sheetdbResponse.status,
                headers: headers,
                body: JSON.stringify({ success: false, message: `Error en la operación de SheetDB: ${result.message || 'Error desconocido'}`, details: result })
            };
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ success: true, message: `Operación de ${entityType} '${action}' completada.`, data: result })
        };

    } catch (error) {
        console.error(`Error en la función manage-sheetdb para la acción '${action}' y entidad '${entityType}':`, error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, message: 'Error interno del servidor.', error: error.message })
        };
    }
};
