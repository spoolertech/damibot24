import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import admin from 'firebase-admin';

// Leer credenciales desde variable de entorno
const firebaseCredentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({
    credential: admin.credential.cert(firebaseCredentials),
    databaseURL: 'https://damibot-76f13-default-rtdb.firebaseio.com',
});

const db = admin.database();

const client = new Client({
    authStrategy: new LocalAuth(),
});

let userResponses = {};

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea el código QR');
});

client.on('ready', () => {
    console.log('BOT READY');
});

client.on('message', async (message) => {
    const from = message.from;
    const text = message.body.trim().toLowerCase();

    if (!userResponses[from]) {
        userResponses[from] = { step: 0, responses: {} };
    }

    let user = userResponses[from];
    let step = user.step;

    switch (step) {
        case 0:
            if (text === 'hola' || text === 'hola,') {
                message.reply('👋🏻 ¡Bienvenido a Villanueva Padel! 🎾\n(San Isidro Labrador)\n👉🏻 Por favor, ingresa tu *Nombre* y *Número de Lote* en el siguiente formato: *Juan Pérez Lote 123*');
                user.step = 1;
            }
            break;

        case 1:
            const parts = text.split(' - ').join(' ').split(' ');
            const name = parts.slice(0, parts.length - 1).join(' ');
            const lotNumber = parts[parts.length - 1];

            user.responses.name = name;
            user.responses.lotNumber = lotNumber;

            message.reply('🥳 Ahora Ingresa en qué cancha vas a jugar. Responde con *1*, *2* o *3*');
            user.step = 2;
            break;

        case 2:
            if (['1', '2', '3'].includes(text)) {
                user.responses.court = text;
                message.reply('⚠️ ¿Tenes invitados sin carnet para declarar? 👥👥\nResponde *SI* o *NO*');
                user.step = 3;
            } else {
                message.reply('Por favor ingresa *1*, *2* o *3* para la cancha.');
            }
            break;

        case 3:
            if (text === 'si' || text === 'sí') {
                user.responses.hasGuests = 'Sí';
                message.reply('➡️ ¿Cuántos invitados sin Carnet tenes ❓❓❓\nResponde con *1*, *2* o *3*');
                user.step = 4;
            } else if (text === 'no') {
                user.responses.hasGuests = 'No';
                sendSummary(message, user);
                user.step = 0;
            } else {
                message.reply('Por favor responde con *SI* o *NO*');
            }
            break;

        case 4:
            if (['1', '2', '3'].includes(text)) {
                user.responses.guestCount = text;
                user.responses.guestDetails = [];
                message.reply(`🙋🏼 Ingresa el nombre y número de lote del primer invitado (Ejemplo: Juan Pérez Lote 123)`);
                user.step = 5;
            } else {
                message.reply('Por favor ingresa *1*, *2* o *3* para la cantidad de invitados');
            }
            break;

        case 5:
            const guestNumber = parseInt(user.responses.guestCount, 10);
            const guestIndex = user.responses.guestDetails.length;

            if (guestIndex < guestNumber) {
                const guestData = text.split(' - ').join(' ').split(' ');
                const guestName = guestData.slice(0, guestData.length - 1).join(' ');
                const guestLotNumber = guestData[guestData.length - 1];
                user.responses.guestDetails.push(`${guestName} Lote ${guestLotNumber}`);

                if (user.responses.guestDetails.length < guestNumber) {
                    message.reply(`🙋🏼 Ingresa el nombre y número de lote del invitado ${guestIndex + 2}`);
                } else {
                    sendSummary(message, user);
                    user.step = 0;
                }
            }
            break;

        default:
            message.reply('❓ Lo siento, no entendí eso. Escribe "hola" para empezar.');
    }
});

function sendSummary(message, user) {
    const { name, lotNumber, court, hasGuests, guestCount, guestDetails } = user.responses;

    let summary = `🎾 Detalle de la Reserva 🎾\n\nNombre y Lote: *${name} ${lotNumber}*\nCancha Reservada: *Cancha ${court}*\nInvitados: *${hasGuests === 'No' ? 'NO' : 'SI'}*\n`;

    if (hasGuests === 'Sí') {
        summary += `Cantidad de Invitados: *${guestCount}*\n`;
        guestDetails.forEach((guest, index) => {
            summary += `Invitado ${index + 1}: ${guest}\n`;
        });
    }

    summary += `\n🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾
Gracias por la info!!! ❤️ Todo listo! Ahora podés comenzar a jugar‼️.

* 🤔 Recordá, si todavía no pasaste, que si querés abonar en efectivo podes acercarte a la oficina y hacerlo. De lo contrario te lo podemos cargar por expensas! 📩

* Este sistema NO REEMPLAZA a la reserva por PADELINK, si no la hiciste, hacela así nadie te pide la cancha 😡 mientras estes jugando 🏓.

Gracias por elegirnos 😍😍!! Disfruten el partido!!!
🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾`;

    message.reply(summary);

    const data = { name, lotNumber, court, hasGuests, guestCount, guestDetails };
    saveDataToFirebase(data);
}

function saveDataToFirebase(data) {
    const ref = db.ref('reservas');
    const newRef = ref.push();
    newRef.set(data)
        .then(() => console.log('✅ Datos guardados en Firebase'))
        .catch((err) => console.error('❌ Error al guardar en Firebase:', err));
}

client.initialize();
