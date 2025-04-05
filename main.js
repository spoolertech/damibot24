const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');

// 🔥 Credenciales Firebase incrustadas (temporalmente)
const serviceAccount = {
  type: "service_account",
  project_id: "damibot-76f13",
  private_key_id: "53037372c0d4684a3d16522fa4a2fa29c87d8f51",
  private_key: `-----BEGIN PRIVATE KEY-----
nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC3m84RdvL5GZ90\nwQsymCo9Yy3l9G3qr5k3ppy3ceUbdFLSludzLmoApMzagKV5CEx6pUgUtH16ix0G\nsLuK+/yJ9jpl8EMbezKdQtQJtd4wRDwYFdfHl0dCvEdPMPGk5w7IexWhrWe7y+CO\nLguof0f/IztrvsXOWdikwz1+2zTA0S4PlOBoOl1DaK3E19E7lyIvEy49t2Fql8wJ\nDdK1VhESFWO99U13h9dytfRybWG/eC18ewNHf5KQwNlYGobg/l7ybdDeeICanVR9\nox0vbiMhD84ulVrQAQ7MNRl39EHQAA2z0d/2Z973QuWFKca2FrpqCOJugS+b+ROT\nVPjctfGZAgMBAAECggEANkaDYtxDtOkjHtNV6Q3cJqtjzP81YtOnujCxUPUFIdmA\nBip/nqfQxAHzYH/46k9OtE6ZgS1djlUDLpAd0Fbu7yVvW+TrIXuImb5AieJOHPx+\nuyvxzllkwlB/z+QK+pEm6JKh8VoeOQBqj/0Cizuc38ndbdtGA9rBVOs2CYLpFDoA\nLZ/p3r7sx3Btj8YdGPGGDIRcbkHba45xuaYuFxhNvq96b5gK658u6U8nUtQXJedO\n78StY9mUlXQGjGKKEtQG54pN2uvoe6qTQZSgAPXGebYA37NEIQY+GNcK3u+Fn7fR\n6xejGDLl+CPNNCd9N7I/AFKbbloWGIlwna8KSMIrlQKBgQD5kTYBdC2c53ObOULz\nbN5IijdwRqZwcY2PjfbD2wvbOfqEzbRWWrUQQIMV+wfewT4pwaO/1SdhoCVewNgv\nPqj/sMl4rd9qKaapDKiG0s8U+YFj4YrIIGcNCHlq//F08ftJGq71bOxL2HxjOBBR\njXQSrTXOhc49v9VNh5wNTor+IwKBgQC8V1xhTaiRLfFHqfckhCwUJJvFwNuBzxYj\nemraZtGDaXxCJncwmV3PxAEK+OdyqQqamJuZVRoJ6u4sedRu5ksKxSXJRkkmMsNi\n2nGI0pnowHBl3WfDI4nlqCBuUFYmAe3b9lDpnTz2mMJlEmEZug1grU2NBK4TdKAU\nBYQkjRdnEwKBgA7qg+zQUc2X88vqPzsnXZ2+TRPz1QzRbKGQ3ZfVJr9CltuLI+Up\nZLsE8BDHQTAqIpoCTdQwXDs0hCdGpWUlfJpTqacB1WGV/bUK4aO1Q9VAGGCs4UuW\nzDH2OLOReo//yoITCzP1/6WE2eJgPnFxX+eh3J5sVuhP5+LLYSNWd247AoGAWMuP\nQEjOunPAl5robAzsgyqnTlqYouCxfVSP4Bwtlxk6fi2IcB8+fV/ZZgTnicVsvGpK\nocXfmuFqHQnrP8XPh2pfYD+E6T9xor9+W5V+/p8L3tq9uuCceOwFLj0uAIlUTSoa\nB6ocPd7Td7dslCaFfBj4wQ19zKpldksLe/gRGoUCgYEAhBTnWdFHk+NBUTn3ev2R\npjEbaa3dIjTHyCITraRLvOxUIy9eLFo6kAibQ8cFmXjsRWpFaaMCqq7099Ez1LFO\n8e71iBu2AmlsULsXj0ecrv0vZyq395mGrTwZ4+XmCJjYU/KjOjUeUslPKkzXAyEg\n3iNRIQkg+fE7Jz5GHfzE0AA=
-----END PRIVATE KEY-----\n`,
  client_email: "firebase-adminsdk-XXXX@damibot-76f13.iam.gserviceaccount.com",
  client_id: "XXXXXXXXXXXXXXXXXXXX",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-XXXX%40damibot-76f13.iam.gserviceaccount.com"
};

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
        sendSummary(message);
        user.step = 0;
      } else {
        message.reply('Por favor responde con *SI* o *NO*');
      }
      break;

    case 4:
      if (text === '1' || text === '2' || text === '3') {
        user.responses.guestCount = text;
        user.responses.guestDetails = [];
        collectGuestDetails(message, text);
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
          sendSummary(message);
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

function collectGuestDetails(message, guestCount) {
  const from = message.from;
  let user = userResponses[from];

  message.reply(`🙋🏼 Ingresa el nombre y número de lote del primer invitado (Ejemplo: Juan Pérez Lote 123)`);
  user.step = 5;
}

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

function saveDataToFirebase(data) {
  const ref = db.ref('reservas');
  const newReservaRef = ref.push();
  newReservaRef.set(data)
    .then(() => console.log('Datos guardados en Firebase'))
    .catch((error) => console.log('Error al guardar en Firebase: ', error));
}

// Iniciar el cliente de WhatsApp
client.initialize();
