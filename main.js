const { Client, RemoteAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const admin = require('firebase-admin');
const { Firestore } = require('firebase-admin/firestore');

// Firebase config
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://damibot-76f13-default-rtdb.firebaseio.com',
});

const db = admin.database();
const firestore = new Firestore();

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

let qrCodeData = null;
let botRunning = false;
let client = null;

// Cliente de WhatsApp con autenticación remota (Firebase)
const initializeClient = () => {
  client = new Client({
    authStrategy: new RemoteAuth({
      store: new RemoteAuthStore({
        firestore: firestore,
        backupSyncIntervalMs: 300000,
      }),
      clientId: "damibot-client",
    }),
    puppeteer: {
      args: ['--no-sandbox'],
    },
  });

  // Evento QR
  client.on('qr', (qr) => {
    console.log('📱 QR generado');
    qrCodeData = qr;
  });

  // Evento Ready
  client.on('ready', () => {
    console.log('🤖 Bot listo');
    botRunning = true;
    qrCodeData = null;
  });

  // Evento de mensaje
  let userResponses = {};

  client.on('message', (message) => {
    const from = message.from;
    const text = message.body.trim().toLowerCase();

    if (!userResponses[from]) {
      userResponses[from] = { step: 0, responses: {} };
    }

    const user = userResponses[from];

    switch (user.step) {
      case 0:
        if (text.startsWith('hola')) {
          message.reply('👋🏻 ¡Bienvenido a Villanueva Padel!\n👉🏻 Por favor, ingresá tu *Nombre* y *Número de Lote* en el siguiente formato: *Juan Pérez Lote 123*');
          user.step = 1;
        }
        break;

      case 1:
        const parts = text.split(' - ').join(' ').split(' ');
        const name = parts.slice(0, parts.length - 1).join(' ');
        const lotNumber = parts[parts.length - 1];

        user.responses.name = name;
        user.responses.lotNumber = lotNumber;

        message.reply('🥳 Ahora indicá en qué cancha vas a jugar. Responde con *1*, *2* o *3*');
        user.step = 2;
        break;

      case 2:
        if (['1', '2', '3'].includes(text)) {
          user.responses.court = text;
          message.reply('⚠️ ¿Tenés invitados sin carnet para declarar? Responde *SI* o *NO*');
          user.step = 3;
        } else {
          message.reply('Por favor ingresá *1*, *2* o *3* para la cancha.');
        }
        break;

      case 3:
        if (text === 'si' || text === 'sí') {
          user.responses.hasGuests = 'Sí';
          message.reply('➡️ ¿Cuántos invitados sin carnet tenés? Responde con *1*, *2* o *3*');
          user.step = 4;
        } else if (text === 'no') {
          user.responses.hasGuests = 'No';
          sendSummary(message);
          user.step = 0;
        } else {
          message.reply('Por favor respondé con *SI* o *NO*');
        }
        break;

      case 4:
        if (['1', '2', '3'].includes(text)) {
          user.responses.guestCount = text;
          user.responses.guestDetails = [];
          message.reply(`🙋🏼 Ingresá el nombre y lote del invitado 1 (Ej: Juan Pérez Lote 123)`);
          user.step = 5;
        } else {
          message.reply('Por favor ingresá *1*, *2* o *3*');
        }
        break;

      case 5:
        const guestCount = parseInt(user.responses.guestCount, 10);
        const guestIndex = user.responses.guestDetails.length;

        if (guestIndex < guestCount) {
          const guestData = text.split(' - ').join(' ').split(' ');
          const guestName = guestData.slice(0, guestData.length - 1).join(' ');
          const guestLot = guestData[guestData.length - 1];

          user.responses.guestDetails.push(`${guestName} Lote ${guestLot}`);

          if (user.responses.guestDetails.length < guestCount) {
            message.reply(`🙋🏼 Ingresá el nombre y lote del invitado ${guestIndex + 2}`);
          } else {
            sendSummary(message);
            user.step = 0;
          }
        }
        break;

      default:
        message.reply('❓ Lo siento, no entendí eso. Escribí "hola" para empezar.');
        break;
    }
  });

  client.initialize();
};

// Enviar resumen de la reserva
function sendSummary(message) {
  const from = message.from;
  const user = userResponses[from];
  const { name, lotNumber, court, hasGuests, guestCount, guestDetails } = user.responses;

  let resumen = `🎾 *Detalle de la Reserva* 🎾\n\n🧍‍♂️ Nombre y Lote: *${name} ${lotNumber}*\n🏓 Cancha: *${court}*\n👥 Invitados: *${hasGuests}*\n`;

  if (hasGuests === 'Sí') {
    resumen += `🔢 Cantidad de invitados: *${guestCount}*\n`;
    guestDetails.forEach((guest, i) => {
      resumen += `• Invitado ${i + 1}: ${guest}\n`;
    });
  }

  resumen += `\n✅ ¡Gracias por la info! Todo listo para jugar. 🎾`;

  message.reply(resumen);
  saveToFirebase(user.responses);
}

// Guardar en Firebase
function saveToFirebase(data) {
  const ref = db.ref('reservas');
  ref.push(data)
    .then(() => console.log('📦 Reserva guardada en Firebase'))
    .catch((err) => console.error('❌ Error al guardar en Firebase:', err));
}

// Ruta para la vista principal
app.get('/', (req, res) => {
  if (qrCodeData) {
    const qrImage = qrcode.toDataURL(qrCodeData);
    res.send(`
      <h2>Escaneá el código QR:</h2>
      <img src="${qrImage}" alt="QR Code">
      <br><br>
      <button onclick="generateQRCode()">Generar QR</button>
      <br><br>
      <button onclick="startBot()">Iniciar Bot</button>
      <script>
        function generateQRCode() {
          fetch('/generate-qr')
            .then(response => response.json())
            .then(data => {
              document.querySelector('img').src = data.qrImage;
            });
        }

        function startBot() {
          fetch('/start-bot')
            .then(response => response.json())
            .then(data => {
              alert('Bot iniciado.');
            });
        }
      </script>
    `);
  } else {
    res.send(`
      <h2>Esperando conexión a WhatsApp...</h2>
      <button onclick="generateQRCode()">Generar QR</button>
      <br><br>
      <button onclick="startBot()">Iniciar Bot</button>
      <script>
        function generateQRCode() {
          fetch('/generate-qr')
            .then(response => response.json())
            .then(data => {
              document.querySelector('h2').innerText = 'Escaneá el código QR:';
              document.querySelector('img').src = data.qrImage;
            });
        }

        function startBot() {
          fetch('/start-bot')
            .then(response => response.json())
            .then(data => {
              alert('Bot iniciado.');
            });
        }
      </script>
    `);
  }
});

// Ruta para generar QR manualmente
app.get('/generate-qr', async (req, res) => {
  if (botRunning) {
    return res.status(400).json({ error: 'El bot ya está corriendo.' });
  }

  initializeClient();
  
  client.on('qr', (qr) => {
    qrCodeData = qr;
    qrcode.toDataURL(qr, (err, qrImage) => {
      if (err) {
        return res.status(500).json({ error: 'Error generando QR.' });
      }
      res.json({ qrImage });
    });
  });
});

// Ruta para iniciar el bot
app.get('/start-bot', (req, res) => {
  if (!qrCodeData) {
    return res.status(400).json({ error: 'Por favor, genera un QR primero.' });
  }

  if (botRunning) {
    return res.status(400).json({ error: 'El bot ya está en funcionamiento.' });
  }

  client.on('ready', () => {
    botRunning = true;
    console.log('🤖 Bot listo!');
    res.json({ message: 'Bot iniciado correctamente.' });
  });
});

// Iniciar servidor
app.listen(3000, () => {
  console.log('🚀 Servidor corriendo en http://localhost:3000');
});
