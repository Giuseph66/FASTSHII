import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Colors } from '@/constants/Colors';
import * as WebBrowser from 'expo-web-browser';
import { createPreference } from '@/config/mercadoPago';

const { width, height } = Dimensions.get('window');

export default function MercadoPagoScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const valor = parseFloat(params.valor as string) || 0;
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState<string>('light');
  const [colors, setColors] = useState(Colors['light']);
  const [followSystemTheme, setFollowSystemTheme] = useState<boolean>(false);

  // Função para atualizar o tema com base nas configurações
  const updateTheme = useCallback(async () => {
    try {
      const followSystem = await AsyncStorage.getItem('followSystemTheme');
      const shouldFollowSystem = followSystem === 'true';
      setFollowSystemTheme(shouldFollowSystem);
      
      if (shouldFollowSystem) {
        const systemTheme = colorScheme === 'dark' ? 'dark' : 'light';
        setTheme(systemTheme);
        setColors(Colors[systemTheme]);
      } else {
        const savedTheme = await AsyncStorage.getItem('selectedTheme');
        if (savedTheme) {
          setTheme(savedTheme);
          setColors(Colors[savedTheme as keyof typeof Colors]);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar o tema:', error);
    }
  }, [colorScheme]);

  useEffect(() => {
    updateTheme();
  }, [updateTheme, colorScheme]);

  useEffect(() => {
    if (followSystemTheme) {
      const systemTheme = colorScheme === 'dark' ? 'dark' : 'light';
      setTheme(systemTheme);
      setColors(Colors[systemTheme]);
    }
  }, [followSystemTheme, colorScheme]);

  // Verificar autenticação ao carregar a tela
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        const userName = await AsyncStorage.getItem('userName');
        
        if (!userToken || !userName) {
          
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        
      }
    };
    
    checkAuth();
  }, []);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      const userName = await AsyncStorage.getItem('userName');
      const email = await AsyncStorage.getItem('userEmail');
      if (!userToken || !userName) {
        
        return;
    }
    
    const paymentRecord = {
      userId: userToken,
      userName: userName,
      amount: valor,
      method: 'mercadopago',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      externalReference: userToken
    };
    const pix = true;
    let preferenceData_tipo_pg;
    if (pix) {
      preferenceData_tipo_pg = {
        payment_method: "pix",
        payment_methods_configurations: {
          default_payment_method_id: "pix",
          installments: 1
        },
        payment_methods: {
          installments: 1,
          default_installments: 1,
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "atm" }
          ]
        },
      };
    } else {
      preferenceData_tipo_pg = {
        payment_methods: {
        installments: 1,
        default_installments: 1,
        excluded_payment_types: [
          { id: "pix" },
          { id: "debit_card" },
          { id: "bank_transfer" },
          { id: "atm" }
        ]
      },
      payment_methods_configurations: {
        default_payment_method_id: "credit_card",
        installments: 1
      },
    }
  }

    const paymentRef = await addDoc(collection(firestore, 'payments'), paymentRecord);
    // Criar preferência de pagamento no Mercado Pago
      const webhook_url= "https://pag.neurelix.com.br"
      const preferenceData = {
        items: [
          {
            title: "Assinatura Café Computação",
            quantity: 1,
            currency_id: "BRL",
            unit_price: valor
          }
        ],
        payer: {
          name: userName,
          email: email
        },
        back_urls: {
          success: `${webhook_url}/success`,
          failure: `${webhook_url}/failure`,
          pending: `${webhook_url}/pending`
        },
        auto_return: "approved",
        external_reference: {
            userId: userToken,
            userName: userName,
            email: email,
            valor: valor,
            createdAt: serverTimestamp(),
            Id_banco: paymentRef.id
        }, 
        ...preferenceData_tipo_pg,
        webhook_url: `${webhook_url}/webhook`
      };

      const preference = await createPreference(preferenceData);
      // Abrir o navegador com a URL de pagamento
      const result = await WebBrowser.openBrowserAsync(preference.init_point);

      // Atualizar o status da assinatura do usuário
      const userRef = doc(firestore, 'users', userToken);
      await updateDoc(userRef, {
        subscriptionStatus: 'avaliando',
        updatedAt: serverTimestamp()
      });
      
      await AsyncStorage.setItem('lastPaymentId', paymentRef.id);
      await AsyncStorage.setItem('subscriptionStatus', 'avaliando');
      
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.background, colors.background]}
        style={styles.gradient}
      >
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.background }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            Pagamento
          </Text>
          
          <Text style={[styles.value, { color: colors.text }]}>
            R$ {valor.toFixed(2)}
          </Text>

          <TouchableOpacity
            style={[
              styles.payButton, 
              { backgroundColor: colors.tint },
              isLoading && styles.disabledButton
            ]}
            onPress={handlePayment}
            disabled={isLoading}
          >
            {isLoading ? (
            <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.payButtonText, { color: colors.text }]}>
                Pagar com Mercado Pago
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  payButton: {
    padding: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    position: 'absolute',
    top: height * 0.05,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  disabledButton: {
    opacity: 0.7,
  },
}); 