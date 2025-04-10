const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

// Inicializar Express
const app = express();
const port = process.env.PORT || 3000;

// Middleware para formularios
app.use(bodyParser.urlencoded({ extended: true }));

// Inicializar Firebase desde variable de entorno
const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
admin.initializeApp({
    credential: admin.credential.cert(credentials),
    databaseURL: 'https://damibot-76f13-default-rtdb.firebaseio.com',
});

const db = admin.database();

// Cliente de WhatsApp (pero no lo inicializamos aún)
let client;
let qrCodeData;

// Mostrar QR y botón "Iniciar Bot"
app.get('/', async (req, res) => {
    // Creamos el cliente si no existe
    if (!client) {
        client = new Client({ authStrategy: new LocalAuth() });

        client.on('qr', async qr => {
            qrCodeData = await qrcode.toDataURL(qr);
        });

        client.initialize();
    }

    // Esperamos un poco a que se genere el QR
    const html = `
        <html>
        <body style="text-align:center;font-family:sans-serif;padding-top:50px;">
            <h1>Escanea el código QR para iniciar sesión</h1>
            ${qrCodeData ? `<img src="${qrCodeData}" />` : '<p>Generando QR...</p>'}
            <form action="/start-bot" method="POST" style="margin-top:30px;">
                <button type="submit" style="padding:10px 20px;font-size:16px;">Iniciar Bot</button>
            </form>
        </body>
        </html>
    `;
    res.send(html);
});

// Ruta POST para iniciar el bot
app.post('/start-bot', (req, res) => {
    if (!client) return res.send('El cliente no está inicializado aún.');

    client.on('ready', () => {
        console.log('BOT READY');
    });

    // Lógica del bot (como en tu código original)
    let userResponses = {};

    client.on('message', (message) => {
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
                if (text === '1' || text === '2' || text === '3') {
                    user.responses.court = text;
                    message.reply('⚠️ ¿Tenes invitados sin carnet para declarar? 👥👥\nResponde *SI* o *NO*');
                    user.step = 3;
                } else {
                    message.reply('Por favor ingresa *1*, *2* o *3* para la cancha. Si no estás seguro, por favor repite.');
                }
                break;

            case 3:
                if (text === 'si' || text === 'sí') {
                    user.responses.hasGuests = 'Sí';
                    message.reply('➡️ ¿Cuántos invitados sin Carnet tenes ❓❓❓\nResponde con *1*, *2* o *3*');
                    user.step = 4;
                } else if (text === 'no') {
                    user.responses.hasGuests = 'No';
                    sendSummary(message, userResponses);
                    user.step = 0;
                } else {
                    message.reply('Por favor responde con *SI* o *NO*');
                }
                break;

            case 4:
                if (text === '1' || text === '2' || text === '3') {
                    user.responses.guestCount = text;
                    user.responses.guestDetails = [];
                    collectGuestDetails(message, text, userResponses);
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
                        message.reply(`🙋🏼 Ingresa el nombre y número de lote del invitado ${guestIndex + 1} (Ejemplo: Juan Pérez Lote 123)`);
                    } else {
                        sendSummary(message, userResponses);
                        user.step = 0;
                    }
                } else {
                    message.reply('Parece que has ingresado más invitados de los que habías indicado. Por favor, verifica.');
                }
                break;

            default:
                message.reply('❓ Lo siento, no entendí eso. Escribe "hola" para empezar.');
                break;
        }
    });

    res.send('✅ Bot iniciado. Ya podés enviar mensajes desde WhatsApp.');
});

function collectGuestDetails(message, guestCount, userResponses) {
    const from = message.from;
    let user = userResponses[from];
    message.reply(`🙋🏼 Ingresa el nombre y número de lote del primer invitado (Ejemplo: Juan Pérez Lote 123)`);
    user.step = 5;
}

function sendSummary(message, userResponses) {
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

* Este sistema NO REEMPLAZA a la reserva por PADELINK, si no la hiciste, hacela así nadie te pide la cancha 😡 mientras estés jugando 🏓.

Gracias por elegirnos 😍😍!! Disfruten el partido!!!

🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾🎾`;

    message.reply(summary);

    const data = {
        name,
        lotNumber,
        court,
        hasGuests,
        guestCount,
        guestDetails,
    };
    saveDataToFirebase(data);
}

function saveDataToFirebase(data) {
    const ref = db.ref('reservas');
    const newReservaRef = ref.push();
    newReservaRef.set(data)
        .then(() => console.log('Datos guardados en Firebase'))
        .catch((error) => console.log('Error al guardar en Firebase: ', error));
}

// Iniciar servidor Express
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
