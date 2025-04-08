const admin = require('firebase-admin');
const serviceAccount = require('./chave.json'); // Caminho para a chave do serviço

// Inicialize o Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://base-fastshii.firebaseio.com', // Certifique-se de que o URL está correto
  });
}

module.exports = admin;
