const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');

// Inicializar Firebase
const serviceAccount = require('./damibot-76f13-firebase-adminsdk-fbsvc-53037372c0.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://damibot-76f13-default-rtdb.firebaseio.com',
});

const db = admin.database();

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea el código QR');
});

client.on('ready', () => {
    console.log('BOT READY');
});

// Estados para controlar el flujo de preguntas
let userResponses = {};

// Manejo de mensajes entrantes
client.on('message', (message) => {
    const from = message.from;
    const text = message.body.trim().toLowerCase();

    // Si es un nuevo usuario, inicializamos su estado
    if (!userResponses[from]) {
        userResponses[from] = { step: 0, responses: {} };
    }

    let user = userResponses[from];
    let step = user.step;

    // Lógica de preguntas y respuestas
    switch (step) {
        case 0:
            if (text === 'hola' || text === 'hola,') {
                message.reply('👋🏻 ¡Bienvenido a Villanueva Padel! 🎾\n(San Isidro Labrador)\n👉🏻 Por favor, ingresa tu *Nombre* y *Número de Lote* en el siguiente formato: *Juan Pérez Lote 123*');
                user.step = 1;
            }
            break;

        case 1:
            // No validamos el nombre y lote, simplemente lo guardamos
            const parts = text.split(' - ').join(' ').split(' ');
            const name = parts.slice(0, parts.length - 1).join(' '); // El resto se toma como nombre
            const lotNumber = parts[parts.length - 1]; // El último valor se toma como lote

            user.responses.name = name;
            user.responses.lotNumber = lotNumber;

            message.reply('🥳 Ahora Ingresa en qué cancha vas a jugar. Responde con *1*, *2* o *3*');
            user.step = 2;
            break;

        case 2:
            // Validar cancha (solo 1, 2 o 3)
            if (text === '1' || text === '2' || text === '3') {
                user.responses.court = text;
                message.reply('⚠️ ¿Tenes invitados sin carnet para declarar? 👥👥\nResponde *SI* o *NO*');
                user.step = 3;
            } else {
                message.reply('Por favor ingresa *1*, *2* o *3* para la cancha. Si no estás seguro, por favor repite.');
            }
            break;

        case 3:
            // Validar respuesta SI o NO
            if (text === 'si' || text === 'sí') {
                user.responses.hasGuests = 'Sí';
                message.reply('➡️ ¿Cuántos invitados sin Carnet tenes ❓❓❓\nResponde con *1*, *2* o *3*');
                user.step = 4;
            } else if (text === 'no') {
                user.responses.hasGuests = 'No';
                // Enviar resumen y guardar datos en Firebase (Escenario 1)
                sendSummary(message);
                user.step = 0; // Reiniciar flujo
            } else {
                message.reply('Por favor responde con *SI* o *NO*');
            }
            break;

        case 4:
            // Validar número de invitados (solo 1, 2 o 3)
            if (text === '1' || text === '2' || text === '3') {
                user.responses.guestCount = text;
                user.responses.guestDetails = [];
                collectGuestDetails(message, text); // Recoger detalles de los invitados
                user.step = 5;
            } else {
                message.reply('Por favor ingresa *1*, *2* o *3* para la cantidad de invitados');
            }
            break;

        case 5:
            // Recoger los datos de los invitados
            const guestNumber = parseInt(user.responses.guestCount, 10);
            const guestIndex = user.responses.guestDetails.length;

            if (guestIndex < guestNumber) {
                // Guardamos el nombre y número de lote del invitado
                const guestData = text.split(' - ').join(' ').split(' ');
                const guestName = guestData.slice(0, guestData.length - 1).join(' '); // El resto se toma como nombre
                const guestLotNumber = guestData[guestData.length - 1]; // El último valor se toma como lote
                user.responses.guestDetails.push(`${guestName} Lote ${guestLotNumber}`);

                // Pedimos los detalles del siguiente invitado
                if (user.responses.guestDetails.length < guestNumber) {
                    message.reply(`🙋🏼 Ingresa el nombre y número de lote del invitado ${guestIndex + 1} (Ejemplo: Juan Pérez Lote 123)`);
                } else {
                    // Todos los datos de los invitados recogidos, enviamos resumen y finalizamos el flujo
                    sendSummary(message);
                    user.step = 0; // Reiniciar flujo
                }
            } else {
                // Si se reciben más invitados de los que se indicaron, no avanzamos
                message.reply('Parece que has ingresado más invitados de los que habías indicado. Por favor, verifica.');
            }
            break;

        default:
            message.reply('❓ Lo siento, no entendí eso. Escribe "hola" para empezar.');
            break;
    }
});

// Función para recoger los detalles de los invitados
function collectGuestDetails(message, guestCount) {
    const from = message.from;
    let user = userResponses[from];

    // Recoger detalles del primer invitado
    message.reply(`🙋🏼 Ingresa el nombre y número de lote del primer invitado (Ejemplo: Juan Pérez Lote 123)`);
    user.step = 5;
}

// Función para enviar el resumen
function sendSummary(message) {
    const from = message.from;
    const user = userResponses[from];
    const { name, lotNumber, court, hasGuests, guestCount, guestDetails } = user.responses;

    let summary = `🎾 Detalle de la Reserva 🎾\n\nNombre y Lote: *${name} ${lotNumber}*\nCancha Reservada: *Cancha ${court}*\nInvitados: *${hasGuests === 'No' ? 'NO' : 'SI'}*\n`;

    if (hasGuests === 'Sí') {
        summary += `Cantidad de Invitados: *${guestCount}*\n`;
        guestDetails.forEach((guest, index) => {
            summary += `Invitado ${index + 1}: ${guest}\n`;
        });
    }

    summary += `
    🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾
    Gracias por la info!!! ❤️ Todo listo! Ahora podés comenzar a jugar‼️.
    
    * 🤔 Recordá, si todavía no pasaste, que si querés abonar en efectivo podes acercarte a la oficina y hacerlo. De lo contrario te lo podemos cargar por expensas! 📩
    
    * Este sistema NO REEMPLAZA a la reserva por PADELINK, si no la hiciste, hacela así nadie te pide la cancha 😡 mientras estes jugando 🏓.
    
    Gracias por elegirnos 😍😍!! Disfruten el partido!!!
    
    🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾`;

    message.reply(summary);

    // Guardar los datos en Firebase después de enviar el resumen
    const data = {
        name,
        lotNumber,
        court,
        hasGuests,
        guestCount,
        guestDetails
    };
    saveDataToFirebase(data);
}

// Función para guardar los datos en Firebase
function saveDataToFirebase(data) {
    const ref = db.ref('reservas');  // Usamos 'reservas' como referencia para almacenar las reservas
    const newReservaRef = ref.push();
    newReservaRef.set(data)
        .then(() => console.log('Datos guardados en Firebase'))
        .catch((error) => console.log('Error al guardar en Firebase: ', error));
}

// Iniciar el cliente de WhatsApp
client.initialize();
