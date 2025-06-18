// Configuração do Mercado Pago
export const MERCADO_PAGO_CONFIG = {
  publicKey: process.env.EXPO_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '',
  accessToken: process.env.EXPO_PUBLIC_MERCADO_PAGO_ACCESS_TOKEN || '',
  clientId: process.env.EXPO_PUBLIC_MERCADO_PAGO_CLIENT_ID || '',
  clientSecret: process.env.EXPO_PUBLIC_MERCADO_PAGO_CLIENT_SECRET || '',
};

// Funções auxiliares para o Mercado Pago
export const createPayment = async (paymentData: any) => {
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADO_PAGO_CONFIG.accessToken}`,
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    throw error;
  }
};

export const getPaymentStatus = async (paymentId: string) => {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_CONFIG.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao obter status do pagamento');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao obter status do pagamento:', error);
    throw error;
  }
};

export const createPreference = async (preferenceData: any) => {
  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer APP_USR-5874249072568848-052123-21e235f828a3ab2fc1f11090d80f92a2-267745032`,
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      throw new Error('Erro ao criar preferência de pagamento');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar preferência:', error);
    throw error;
  }
}; 