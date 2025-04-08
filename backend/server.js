const express = require('express');
const bodyParser = require('body-parser');
const admin = require('./firebaseAdmin'); // Importa a configuração do Firebase Admin SDK

const app = express();

// Middleware
app.use(bodyParser.json());

// Rota de registro
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    console.log('Usuário criado no backend:', userRecord); // Log para verificar o usuário criado

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error) {
    console.error('Erro ao cadastrar usuário no backend:', error); // Log para verificar o erro
    res.status(500).json({ error: error.message });
  }
});

// Rota de login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    // O Firebase Admin SDK não suporta autenticação direta de senha.
    // Para autenticação, use o Firebase Authentication no frontend.
    res.status(400).json({ error: 'Use o Firebase Authentication no frontend para login.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
