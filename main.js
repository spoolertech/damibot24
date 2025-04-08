const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Crear la carpeta de sesión si no existe
const sessionPath = path.join(__dirname, 'session');
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath);
}

// Inicializar el cliente
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: sessionPath
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = null;

// Endpoint para mostrar QR
app.get('/', async (req, res) => {
  if (qrCodeData) {
    const qrImage = await qrcode.toDataURL(qrCodeData);
    res.send(`
      <div style="text-align:center">
        <h1>Escaneá el QR para conectar WhatsApp</h1>
        <img src="${qrImage}" />
        <p>Una vez conectado, no es necesario escanear de nuevo.</p>
      </div>
    `);
  } else {
    res.send('<h2>✅ WhatsApp ya está conectado.</h2>');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// Eventos del cliente
client.on('qr', (qr) => {
  qrCodeData = qr;
  console.log('✅ QR generado correctamente');
});

client.on('ready', () => {
  qrCodeData = null;
  console.log('🤖 Bot listo para recibir mensajes');
});

client.on('authenticated', () => {
  console.log('📱 WhatsApp autenticado correctamente');
});

client.on('disconnected', (reason) => {
  console.log('🚫 Desconectado de WhatsApp:', reason);
  console.log('⏳ Reiniciando cliente...');
  client.initialize(); // Reinicia el cliente si Render reinicia el contenedor
});

// Tu lógica de mensajes
client.on('message', (message) => {
  if (message.body.toLowerCase() === 'hola') {
    message.reply('¡Hola! ¿En qué puedo ayudarte?');
  }

  // Aquí agregá el flujo de reservas, Firebase, etc.
});

client.initialize();
