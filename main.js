const { Client, RemoteAuth } = require('whatsapp-web.js');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { Firestore } = require('firebase-admin/firestore');
const { RemoteAuthStore } = require('wwebjs-remote-auth');
const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const admin = require('firebase-admin');

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

// Cliente de WhatsApp con autenticación remota (Firebase)
const client = new Client({
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

// Ruta principal
app.get('/', async (req, res) => {
  if (qrCodeData) {
    const qrImage = await qrcode.toDataURL(qrCodeData);
    res.send(`<h2>Escaneá el código QR:</h2><img src="${qrImage}" alt="QR Code">`);
  } else {
    res.send(`<h2>Esperando conexión a WhatsApp...</h2>`);
  }
});

// Evento QR
client.on('qr', (qr) => {
  console.log('📱 QR generado');
  qrCodeData = qr;
});

// Evento Ready
client.on('ready', () => {
  console.log('🤖 Bot listo');
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

function saveToFirebase(data) {
  const ref = db.ref('reservas');
  ref.push(data)
    .then(() => console.log('📦 Reserva guardada en Firebase'))
    .catch((err) => console.error('❌ Error al guardar en Firebase:', err));
}

// Iniciar servidor y cliente de WhatsApp
app.listen(3000, () => {
  console.log('🚀 Servidor corriendo en http://localhost:3000');
});

client.initialize();
