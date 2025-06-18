// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp, getDoc } = require('firebase/firestore');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const token = 'APP_USR-5874249072568848-052123-21e235f828a3ab2fc1f11090d80f92a2-267745032';
const DOMINIO = 'https://1a2e-177-39-129-8.ngrok-free.app';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAMNNWxoA5Xz4xA0IHm40yKf-ahFjplmFI",
  authDomain: "cafe-da-computacao.firebaseapp.com",
  databaseURL: "https://cafe-da-computacao-default-rtdb.firebaseio.com",
  projectId: "cafe-da-computacao",
  storageBucket: "cafe-da-computacao.firebasestorage.app",
  messagingSenderId: "976711742918",
  appId: "1:976711742918:web:dd601bb912da3c3225eec7",
  measurementId: "G-ZWZKNRE7PL"
};
const firebaseConfig_fastshii = {
  apiKey: "AIzaSyCb17Coub8NwR4eXiMrvrIzyPPOsAVwdUo",
  authDomain: "base-fastshii.firebaseapp.com",
  databaseURL: "https://base-fastshii-default-rtdb.firebaseio.com",
  projectId: "base-fastshii",
  storageBucket: "base-fastshii.firebasestorage.app",
  messagingSenderId: "1023790791454",
  appId: "1:1023790791454:web:041067783fe2c25384a70f",
  measurementId: "G-CDERLJ45B0"
};


// Inicializa FASTSHII se necessário
const firebaseapp_fastshii = getApps().find(app => app.name === 'fastshii') 
  || initializeApp(firebaseConfig_fastshii, 'fastshii');
const db_fastshii = getFirestore(firebaseapp_fastshii);

// Inicializa padrão (DEFAULT)
const firebaseApp = getApps().find(app => app.name === '[DEFAULT]')
  || initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Load environment variables
dotenv.config();

// Debug: Verificar se o token está sendo carregado
console.log('MP_ACCESS_TOKEN:', token ? 'Token presente' : 'Token ausente');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('src/public')); // Serve static files from public directory


// Webhook to receive payment notifications
app.post('/webhook', async (req, res) => {
  try {
    const payment = req.body;
    console.log('Webhook received:', payment);

    // Verificar o status do pagamento
    if (payment.type === 'payment') {
      const paymentId = payment.data.id;
      
      try {
        const response = await axios.get(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const paymentInfo = response.data;
        console.log('Payment status:', paymentInfo.status);
        console.log('Payment details:', paymentInfo);

        // Parse external_reference se for uma string
        let externalRef = paymentInfo.external_reference;
        if (typeof externalRef === 'string') {
          try {
            externalRef = JSON.parse(externalRef);
          } catch (e) {
            console.error('Erro ao fazer parse do external_reference:', e);
            return res.sendStatus(400);
          }
        }

        console.log('Referência processada:', externalRef);

        // Aqui você pode implementar a lógica baseada no status do pagamento
        switch (paymentInfo.status) {
          case 'approved':
            console.log('Pagamento aprovado!');
            if(externalRef.app === 'fastshii'){
              if (externalRef.tipo === 'contrato'){
                await altoriza_fastshii_pg_contrato(externalRef.userId, externalRef.contractId, 'approve');
              }else{
                console.log('Pagamento aprovado!');
              }
            }else{
            try {
              if (!externalRef || !externalRef.Id_banco || !externalRef.userId) {
                throw new Error('Dados de referência inválidos');
              }

              const comprovante = null;
              console.log('Receipt image available:', !!comprovante);
              // Gerar o comprovante
              let html = fs.readFileSync('./main.html', 'utf8');
              html = html
                .replace('{{payment_id}}', paymentId)
                .replace('{{status}}', 'APROVADO')
                .replace('{{payment_method}}', paymentInfo.payment_method_id)
                .replace('{{amount}}', paymentInfo.transaction_amount)
                .replace('{{payer}}', externalRef.userName || 'Cliente')
                .replace('{{date}}', new Date(paymentInfo.date_approved).toLocaleString('pt-BR'))

              const browser = await puppeteer.launch({ 
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
              });
              const page = await browser.newPage();

              await page.setViewport({
                width: 800,
                height: 800,
                deviceScaleFactor: 2
              });

              await page.setContent(html, { waitUntil: 'networkidle0' });
              const buffer = await page.screenshot({
                type: 'png',
                fullPage: true,
                omitBackground: true
              });

              await browser.close();

              const base64Image = buffer.toString('base64');

              // Atualizar status do pagamento com o comprovante
              const paymentRef = doc(db, 'payments', externalRef.Id_banco);
              await updateDoc(paymentRef, { 
                status: 'approved',
                receiptImage: `data:image/png;base64,${base64Image}` || null,
                paymentDetails: {
                  transactionId: paymentInfo.transaction_details?.transaction_id || null,
                  paymentMethod: paymentInfo.payment_method_id || null,
                  amount: paymentInfo.transaction_amount || null,
                  date: paymentInfo.date_approved || null
                }
              });

              // Atualizar status da assinatura do usuário
              const userRef = doc(db, 'users', externalRef.userId);
              const oneMonthFromNow = new Date();
              oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
              
              await updateDoc(userRef, { 
                subscriptionStatus: 'active', 
                subscriptionStartDate: new Date(),
                subscriptionEndDate: oneMonthFromNow 
              });

              console.log('Pagamento, comprovante e assinatura atualizados com sucesso!');
            } catch (error) {
              console.error('Erro ao atualizar status:', error);
              return res.status(500).json({ error: error.message });
            }
          }
            break;

          case 'rejected':
            if(externalRef.app === 'fastshii'){
              if (externalRef.tipo === 'contrato'){
                await altoriza_fastshii_pg_contrato(externalRef.userId, externalRef.contractId, 'reject');
              }else{
                console.log('Pagamento rejeitado!');
              }
            }else{
            console.log('Pagamento rejeitado!');
            try {
              if (!externalRef || !externalRef.Id_banco || !externalRef.userId) {
                throw new Error('Dados de referência inválidos');
              }

              // Atualizar status do pagamento
              const paymentRef = doc(db, 'payments', externalRef.Id_banco);
              await updateDoc(paymentRef, { 
                status: 'rejected',
                paymentDetails: {
                  transactionId: paymentInfo.transaction_details?.transaction_id || null,
                  paymentMethod: paymentInfo.payment_method_id || null,
                  amount: paymentInfo.transaction_amount || null,
                  date: paymentInfo.date_last_updated || null
                }
              });

              // Atualizar status da assinatura do usuário
              const userRef = doc(db, 'users', externalRef.userId);
              await updateDoc(userRef, { subscriptionStatus: 'rejected' });

              console.log('Status de rejeição atualizado com sucesso!');
            } catch (error) {
              console.error('Erro ao atualizar status de rejeição:', error);
              return res.status(500).json({ error: error.message });
            }
          }
            break;

          case 'pending':
            console.log('Pagamento pendente!');
            break;

          default:
            console.log('Status desconhecido:', paymentInfo.status);
        }

      } catch (error) {
        console.error('Error verifying payment:', error.response?.data || error.message);
        return res.status(500).json({ error: 'Erro ao verificar pagamento' });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});
app.get('/webhook', (req, res) => {
  res.send('Voce nao deveria estar aqui!');
});
app.get('/verificar_pagamento/:paymentId', async (req, res) => {
  try {
    console.log('Verificando pagamento:', req.params.paymentId);
    console.log('Token usado:', token ? 'Token presente' : 'Token ausente');

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${req.params.paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Erro ao verificar pagamento',
      details: error.response?.data || error.message
    });
  }
});

// Success page
app.get('/success', (req, res) => {
  res.send('Payment successful!');
});

// Failure page
app.get('/failure', (req, res) => {
  res.send('Payment failed!');
});

// Pending page
app.get('/pending', (req, res) => {
  res.send('Payment pending!');
});

app.get('/', (req, res) => {
  console.log('Acessando a página inicial');
  res.status(200).sendFile(path.join(__dirname, 'public', 'perigo.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Catch-all route for unauthorized access
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'perigo.html'));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

/**
 * Aprova ou rejeita manualmente um pagamento/contrato premium.
 * Espera receber no body: { userId: string, bancoId: string, action: 'approve' | 'reject' }
 */
const altoriza_fastshii_pg_contrato = async (userId, bancoId, action) => {
  try {
    console.log('userId', userId);
    console.log('bancoId', bancoId);
    console.log('action', action);
    if (!userId || !bancoId || !action) {
      console.log('userId, bancoId e action são obrigatórios');
      return;
    }

    if (!['approve', 'reject'].includes(action)) {
      console.error("action deve ser 'approve' ou 'reject'");
      return;
    }

    // Verifica se existe o pagamento
    const paymentRef = doc(db_fastshii, 'advertising_contracts', bancoId);
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) {
      console.error('Pagamento não encontrado');
      return;
    }

    // Verifica se o usuário existe
    const userRef = doc(db_fastshii, 'usuarios', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.error('Usuário não encontrado');
      return;
    }

    if (action === 'approve') {
      // Atualiza pagamento
      await updateDoc(paymentRef, {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });
      // Adiciona o post no banco de dados
      const approvedContract = paymentSnap.data();
      let compressedImages = [];
          if (approvedContract.images && approvedContract.images.length) {
            for (const img of approvedContract.images) {
              const cImg = await compressBase64Image(img);
              compressedImages.push(cImg);
            }
          }

          const adPostData = {
            userId: approvedContract.userId,
            username: approvedContract.advertiserName,
            content: approvedContract.adDescription,
            text: approvedContract.adDescription,
            timestamp: Date.now(),
            likes: {},
            comments: {},
            images: compressedImages,
            imageBase64: compressedImages.length ? compressedImages[0] : null,
            ad: true,
            adLinks: approvedContract.links || [],
            adContractId: approvedContract.id,
            adStartDate: approvedContract.startDate,
            adEndDate: approvedContract.endDate,
            visualizacoes_max_diarias: approvedContract.reachPerDay,
            dailyLimit: 5,
            viewsTotal: 0,
            viewsByDate: {},
          };
          await addDoc(collection(db_fastshii, 'posts'), adPostData);

      console.log('Pagamento aprovado e assinatura ativada.');
      return;
    }

    if (action === 'reject') {
      // Atualiza pagamento
      await updateDoc(paymentRef, {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });

      // Marca assinatura como rejeitada
      await updateDoc(userRef, {
        subscriptionStatus: 'rejected',
      });

      console.log('Pagamento rejeitado.');
      return;
    }

  } catch (error) {
    console.error('Erro em altoriza_fastshii_pg_contrato:', error);
    console.error('Erro interno do servidor');
    return;
  }
};

/**
 * Comprime uma imagem base64 (JPEG/PNG) até ficar abaixo de 900k caracteres (~675kb).
 * Reduz qualidade e largura progressivamente.
 * @param {string} base64 - Imagem em base64 (com ou sem prefixo data:image).
 * @returns {Promise<string>} - Imagem comprimida em base64.
 */
const compressBase64Image = async (base64) => {
  try {
    // Detecta o tipo da imagem (jpeg/png)
    let matches = base64.match(/^data:(image\/jpeg|image\/png);base64,/);
    let imageType = matches ? matches[1].split('/')[1] : 'jpeg';
    let base64Data = base64.replace(/^data:image\/\w+;base64,/, '');

    let buffer = Buffer.from(base64Data, 'base64');
    let quality = 80;
    let width = 900;
    let outputBuffer = buffer;

    // Loop para comprimir até atingir o limite ou qualidade mínima
    while (outputBuffer.length > 675000 && quality >= 30) {
      outputBuffer = await sharp(buffer)
        .resize({ width })
        .toFormat(imageType, { quality })
        .toBuffer();

      quality -= 10;
      width = Math.floor(width * 0.9);
    }

    // Retorna base64 com prefixo
    return `data:image/${imageType};base64,${outputBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Erro ao comprimir imagem:', e);
    return base64; // fallback: retorna original
  }
};