const { Client, RemoteAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const { initializeApp, getStorage } = require('firebase-admin/app');
const { getStorage: getFirebaseStorage } = require('firebase-admin/storage');
const path = require('path');

// Inicializar Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

initializeApp(firebaseConfig);

// Inicializar cliente de WhatsApp con autenticación remota utilizando Firebase Storage
const client = new Client({
  authStrategy: new RemoteAuth({
    store: new FirebaseStorageStore({
      firebaseStorage: getFirebaseStorage(),
      sessionPath: 'sessions/whatsapp-session.json', // Ruta en Firebase Storage donde se almacenará la sesión
    }),
    backupSyncIntervalMs: 600000, // Sincronizar sesión cada 10 minutos
  }),
});

// Inicializar servidor Express
const app = express();

// Habilitar que Express sirva archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal que servirá la página con el QR
app.get('/', (req, res) => {
  res.send('<h1>Generando el código QR...</h1>');
});

// Ruta para generar y servir el QR como imagen
app.get('/qr', (req, res) => {
  client.on('qr', (qr) => {
    // Generar el código QR y devolverlo como imagen
    qrcode.toDataURL(qr, (err, url) => {
      if (err) {
        res.status(500).send('Error generando el QR');
      } else {
        res.send(`<h1>Escanea el código QR:</h1><img src="${url}" alt="QR Code">`);
      }
    });
  });
});

// Iniciar el servidor web
app.listen(3000, () => {
  console.log('🚀 Servidor corriendo en http://localhost:3000');
});

// Inicializar WhatsApp Client
client.on('ready', () => {
  console.log('🤖 BOT READY');
});

client.initialize();

// Variables y lógica del bot
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
        message.reply('⚠️ ¿Tenés invitados sin carnet para declarar? 👥👥\nResponde *SI* o *NO*');
        user.step = 3;
      } else {
        message.reply('Por favor ingresa *1*, *2* o *3* para la cancha.');
      }
      break;

    case 3:
      if (text === 'si' || text === 'sí') {
        user.responses.hasGuests = 'Sí';
        message.reply('➡️ ¿Cuántos invitados sin Carnet tenés❓ Responde con *1*, *2* o *3*');
        user.step = 4;
      } else if (text === 'no') {
        user.responses.hasGuests = 'No';
        sendSummary(message);
        user.step = 0;
      } else {
        message.reply('Por favor responde con *SI* o *NO*');
      }
      break;

    case 4:
      if (['1', '2', '3'].includes(text)) {
        user.responses.guestCount = text;
        user.responses.guestDetails = [];
        message.reply(`🙋🏼 Ingresá el nombre y número de lote del invitado 1 (Ej: Juan Pérez Lote 123)`);
        user.step = 5;
      } else {
        message.reply('Por favor ingresa *1*, *2* o *3*');
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

  let resumen = `🎾 *Detalle de la Reserva* 🎾\n\n🧍‍♂️ Nombre y Lote: *${name} ${lotNumber}*\n🏓 Can
::contentReference[oaicite:0]{index=0}
 
