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

// Habilitar que Express sirva archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Variable para controlar si ya se envió el QR
let qrSent = false;

// Ruta principal que servirá la página con el QR
app.get('/', (req, res) => {
  res.send('<h1>Generando el código QR...</h1>');
});

// Ruta para generar y servir el QR como imagen
app.get('/qr', (req, res) => {
  if (!qrSent) {  // Solo enviamos el QR una vez
    client.on('qr', (qr) => {
      // Generar el código QR y devolverlo como imagen
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          res.status(500).send('Error generando el QR');
        } else {
          qrSent = true;  // Marcamos que el QR ha sido enviado
          res.send(`
            <html>
              <head><title>Escanea el código QR</title></head>
              <body>
                <h1>Escanea el código QR con WhatsApp</h1>
                <img src="${url}" alt="QR Code">
              </body>
            </html>
          `);
        }
      });
    });
  } else {
    res.send('<h1>Ya has escaneado el QR. Conéctate a WhatsApp.</h1>');
  }
});

// Iniciar el servidor web
app.listen(3000, () => {
  console.log('🚀 Servidor corriendo en http://localhost:3000');
});

// Inicializar WhatsApp Client
client.on('ready', () => {
  console.log('🤖 BOT READY'); // Verifica que el bot está listo
  startBot();  // Llamamos la función que inicia el bot cuando esté listo
});

// Verificar la autenticación y los errores
client.on('auth_failure', (message) => {
  console.error('❌ Error de autenticación:', message);
});

client.on('disconnected', (reason) => {
  console.log('🚫 Desconectado de WhatsApp:', reason);
});

// Confirmación cuando la sesión está activa
client.on('authenticated', () => {
  console.log('📱 WhatsApp conectado y autenticado correctamente');
});

client.initialize();

// Variables y lógica del bot (tu lógica de respuesta del bot sigue igual)
let userResponses = {};

client.on('message', (message) => {
  console.log('🔔 Nuevo mensaje recibido:', message.body); // Verificar que el bot reciba el mensaje

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

function startBot() {
  console.log("🤖 El bot ahora está listo para recibir mensajes.");
}
