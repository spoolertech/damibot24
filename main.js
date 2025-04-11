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
let client = null;
let botRunning = false;  // Variable para controlar si el bot ya está corriendo.

const initializeClient = () => {
  if (client) return;  // Si el cliente ya está inicializado, no hacer nada.

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

  client.on('qr', (qr) => {
    console.log('📱 QR generado');
    qrCodeData = qr;
  });

  client.on('ready', () => {
    console.log('🤖 Bot listo');
    botRunning = true;  // Marca el bot como corriendo.
    qrCodeData = null;  // Borra el QR después de la conexión.
  });

  client.on('message', (message) => {
    // Aquí iría la lógica de los mensajes (lo que ya has implementado para las interacciones con el bot)
  });

  client.initialize();  // Inicia el cliente de WhatsApp
};

// Ruta para la vista principal
app.get('/', (req, res) => {
  if (qrCodeData) {
    // Si hay un QR generado, mostramos el QR.
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
      <br><br>
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
app.get('/generate-qr', (req, res) => {
  if (!client) {
    initializeClient();  // Inicializamos el cliente si no está inicializado.
  }

  if (qrCodeData) {
    qrcode.toDataURL(qrCodeData, (err, qrImage) => {
      if (err) {
        return res.status(500).json({ error: 'Error generando QR.' });
      }
      res.json({ qrImage });
    });
  } else {
    res.status(400).json({ error: 'QR no disponible, esperando conexión a WhatsApp.' });
  }
});

// Ruta para iniciar el bot
app.get('/start-bot', (req, res) => {
  if (!client) {
    return res.status(400).json({ error: 'Por favor, inicializa el bot primero.' });
  }

  if (botRunning) {
    return res.status(400).json({ error: 'El bot ya está en funcionamiento.' });
  }

  client.on('ready', () => {
    botRunning = true;  // Marca el bot como corriendo.
    console.log('🤖 Bot listo!');
    res.json({ message: 'Bot iniciado correctamente.' });
  });
});

// Iniciar servidor
app.listen(3000, () => {
  console.log('🚀 Servidor corriendo en http://localhost:3000');
});
