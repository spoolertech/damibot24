const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const admin = require('firebase-admin');
const path = require('path');

// 🔐 Cargar credenciales de Firebase desde la variable de entorno
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://damibot-76f13-default-rtdb.firebaseio.com',
});

const db = admin.database();

// Inicializar cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Inicializar servidor Express
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// ⚠️ Estados de QR y autenticación
let lastQR = null;
let isAuthenticated = false;

// Escuchamos una sola vez y guardamos el QR
client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) {
      lastQR = url;
      console.log('✅ QR generado correctamente');
    } else {
      console.error('❌ Error generando el QR:', err);
    }
  });
});

client.on('authenticated', () => {
  isAuthenticated = true;
  console.log('📱 WhatsApp conectado y autenticado correctamente');
});

client.on('ready', () => {
  console.log('🤖 BOT READY');
  startBot();
});

client.on('auth_failure', (msg) => {
  console.error('❌ Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
  console.log('🚫 Desconectado de WhatsApp:', reason);
  isAuthenticated = false;
  lastQR = null;
});

client.initialize();

// Ruta base
app.get('/', (req, res) => {
  res.redirect('/qr');
});

// Ruta para mostrar el QR
app.get('/qr', (req, res) => {
  if (isAuthenticated) {
    res.send('<h1>✅ Ya escaneaste el QR y el bot está conectado.</h1>');
  } else if (lastQR) {
    res.send(`
      <html>
        <head><title>Escanea el código QR</title></head>
        <body>
          <h1>Escanea el código QR con WhatsApp</h1>
          <img src="${lastQR}" alt="QR Code">
        </body>
      </html>
    `);
  } else {
    res.send('<h1>⏳ Generando código QR... intenta nuevamente en unos segundos.</h1>');
  }
});

// Iniciar servidor en el puerto que Render asigna
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Lógica del bot
let userResponses = {};

client.on('message', (message) => {
  console.log('🔔 Nuevo mensaje:', message.body);
  const from = message.from;
  const text = message.body.trim().toLowerCase();

  if (!userResponses[from]) {
    userResponses[from] = { step: 0, responses: {} };
  }

  const user = userResponses[from];

  switch (user.step) {
    case 0:
      if (text.startsWith('hola')) {
        message.reply('👋🏻 ¡Bienvenido a Villanueva Padel! 🎾\n👉🏻 Ingresá tu *Nombre* y *Lote* (Ej: Juan Pérez Lote 123)');
        user.step = 1;
      }
      break;

    case 1:
      const parts = text.split(' - ').join(' ').split(' ');
      const name = parts.slice(0, parts.length - 1).join(' ');
      const lot = parts[parts.length - 1];

      user.responses.name = name;
      user.responses.lotNumber = lot;

      message.reply('🥳 ¿En qué cancha vas a jugar? Responde con *1*, *2* o *3*');
      user.step = 2;
      break;

    case 2:
      if (['1', '2', '3'].includes(text)) {
        user.responses.court = text;
        message.reply('⚠️ ¿Tenés invitados sin carnet? Responde *SI* o *NO*');
        user.step = 3;
      } else {
        message.reply('Por favor, respondé con *1*, *2* o *3*');
      }
      break;

    case 3:
      if (text === 'si' || text === 'sí') {
        user.responses.hasGuests = 'Sí';
        message.reply('➡️ ¿Cuántos invitados sin carnet? (1, 2 o 3)');
        user.step = 4;
      } else if (text === 'no') {
        user.responses.hasGuests = 'No';
        sendSummary(message);
        user.step = 0;
      } else {
        message.reply('Responde con *SI* o *NO*');
      }
      break;

    case 4:
      if (['1', '2', '3'].includes(text)) {
        user.responses.guestCount = text;
        user.responses.guestDetails = [];
        message.reply('🙋🏼 Ingresá nombre y lote del invitado 1 (Ej: Juan Pérez Lote 123)');
        user.step = 5;
      } else {
        message.reply('Por favor ingresá *1*, *2* o *3*');
      }
      break;

    case 5:
      const guestCount = parseInt(user.responses.guestCount, 10);
      const guestIndex = user.responses.guestDetails.length;

      if (guestIndex < guestCount) {
        const guestParts = text.split(' - ').join(' ').split(' ');
        const guestName = guestParts.slice(0, guestParts.length - 1).join(' ');
        const guestLot = guestParts[guestParts.length - 1];

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
      message.reply('❓ Escribí "hola" para empezar.');
      break;
  }
});

function sendSummary(message) {
  const from = message.from;
  const user = userResponses[from];
  const { name, lotNumber, court, hasGuests, guestCount, guestDetails } = user.responses;

  let resumen = `🎾 *Detalle de la Reserva* 🎾\n\n🧍‍♂️ Nombre y Lote: *${name} ${lotNumber}*\n🏓 Cancha: *${court}*\n👥 Invitados: *${hasGuests}*\n`;

  if (hasGuests === 'Sí') {
    resumen += `🔢 Cantidad: *${guestCount}*\n`;
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

function startBot() {
  console.log('🤖 El bot está listo para recibir mensajes');
}
