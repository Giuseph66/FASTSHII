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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import * as WebBrowser from 'expo-web-browser';
import { createPreference } from '@/config/mercadoPago';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc, onSnapshot, getDoc, deleteDoc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function PaymentSelectionScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'credit' | 'pix'>('pix');
  const router = useRouter();
  const params = useLocalSearchParams();
  const [valor, setValor] = useState(parseFloat(params.valor as string) || 0);
  const [valorReal, setValorReal] = useState(parseFloat(params.valor as string) || 0);
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState<string>('default');
  const [colors, setColors] = useState(Colors['light']);
  const [followSystemTheme, setFollowSystemTheme] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [mercadoPago, setMercadoPago] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isScreenMounted, setIsScreenMounted] = useState(true);
  const [isListenerActive, setIsListenerActive] = useState(false);

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

  if(selectedMethod === 'credit'){
    setValor(valor*0.1);
  }else{
    setValor(valor);
  }
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
          const webhookUrl = 'https://pag.neurelix.com.br';
          setValor(30);
          setValorReal(30);

          console.log('Webhook URL:', webhookUrl);
          if (webhookUrl) {
            try {
              const response = await fetch(webhookUrl);
              console.log('Webhook status:', response.status);
              setMercadoPago(response.status === 200);
              setWebhookUrl(webhookUrl);
            } catch (error: any) {
              console.error('Erro ao verificar webhook:', error?.message || 'Erro desconhecido');
              setMercadoPago(false);
            }
          } else {
            console.log('Webhook URL não encontrada nas configurações');
            setMercadoPago(false);
            }
        } catch (error) {
          console.error('Erro ao verificar autenticação:', error);
          
        }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;

    const verifica_status_assinatura = async () => {
      // Se já existe um listener ativo, não criar outro
      if (isListenerActive) {
        console.log('Listener já está ativo, retornando...');
        return;
      }

      const userToken = await AsyncStorage.getItem('userToken');
      if(!userToken || !isScreenMounted){
        console.log('Sem userToken ou tela não montada, retornando...');
        return;
      }

      console.log('Criando novo listener...');
      const userDocRef = doc(firestore, 'users', userToken);
      
      // Usar um único listener com um flag para controlar atualizações
      let isUpdating = false;
      
      unsubscribeUser = onSnapshot(userDocRef, async (doc) => {
        if (!isScreenMounted) {
          console.log('Tela não montada, ignorando atualização...');
          return;
        }

        if (isUpdating) {
          console.log('Atualização em andamento, ignorando...');
          return;
        }

        if (doc.exists()) {
          isUpdating = true;
          try {
            const data = doc.data();
            const status = data.subscriptionStatus;
            console.log('Status atual:', status);
            
            await AsyncStorage.setItem('subscriptionStatus', status);
            
            if(status === 'avaliando' && isScreenMounted){
              console.log('Mostrando modal de avaliação...');
              setIsModalVisible(true);
            }else if(status === 'active'){
              console.log('Status ativo, fechando modal...');
                router.push('/Perfil');
            }else if(isScreenMounted){
              console.log('Outro status, fechando modal...');
              setIsModalVisible(false);
            }
          } finally {
            isUpdating = false;
          }
        }
      });

      setIsListenerActive(true);
      console.log('Listener configurado com sucesso');
    };

    verifica_status_assinatura();

    return () => {
      console.log('Limpando listener...');
      if (unsubscribeUser) {
        unsubscribeUser();
        setIsListenerActive(false);
      }
    };
  }, []); // Removida a dependência de isScreenMounted para evitar recriações

  // Efeito separado para controlar o estado de montagem da tela
  useEffect(() => {
    setIsScreenMounted(true);
    return () => {
      console.log('Tela desmontada, limpando estados...');
      setIsScreenMounted(false);
      setIsListenerActive(false);
    };
  }, []);

  const mudaformadepagamento = (metodo: 'credit' | 'pix') => {
    if(metodo === 'credit'){
      setValor(valorReal + valorReal*0.1);
      setSelectedMethod('credit');
    }else{
      setValor(valorReal);
      setSelectedMethod('pix');
    }
  }
  const handleMercadoPagoPayment = async () => {
    setIsLoading(true);
    try {

      const preferenceData_tipo_pg = {
        payment_methods: {
          installments: 1,
          default_installments: 1,
          excluded_payment_types: selectedMethod === 'pix' ? [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "atm" }
          ] : [
            { id: "pix" },
            { id: "debit_card" },
            { id: "bank_transfer" },
            { id: "atm" }
          ]
        },
        payment_methods_configurations: {
          default_payment_method_id: selectedMethod === 'pix' ? "pix" : "credit_card",
          installments: 1
        },
      };
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
        },
        back_urls: {
          success: `${webhookUrl}/success`,
          failure: `${webhookUrl}/failure`,
          pending: `${webhookUrl}/pending`
        },
        auto_return: "approved",
        external_reference: {
          valor: valor,
          createdAt: serverTimestamp(),
        }, 
        ...preferenceData_tipo_pg,
        webhook_url: `${webhookUrl}/webhook`
      };

      const preference = await createPreference(preferenceData);
      const result = await WebBrowser.openBrowserAsync(preference.init_point);
      console.log('Resultado do pagamento:', result);
      console.log('ignorado');
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
    } finally {
      setIsLoading(false);
    }
  };
  const novo_pagamento = async () => {
    console.log('ignorado');
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
        <Modal
          visible={isModalVisible}
          onRequestClose={() => setIsModalVisible(false)}
          transparent={true}
          style={styles.modalStyle}
        >
          <View style={[styles.modalBackground, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Pagamento em Análise
              </Text>
              <Text style={[styles.modalText, { color: colors.text }]}>
                Você já possui um pagamento sendo avaliado. Deseja aguardar a verificação ou realizar um novo pagamento?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    setIsModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>
                    Aguardar Verificação
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.tint }]}
                  onPress={() => {
                    novo_pagamento();
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text }]}>
                    Realizar Novo Pagamento
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {mercadoPago? (
          <View style={styles.content}>
            <View style={[styles.paymentMethods, {flexDirection: 'column'}]}>
              <Text style={[styles.title, { color: colors.text , fontSize: 30 , fontWeight: 'bold' , marginBottom: 20 , textAlign: 'center'}]}>
                Assinatura Mensal
              </Text>
              <Text style={[styles.choro, { color: colors.text , fontSize: 16 , fontWeight: 'bold' , marginBottom: 20 , textAlign: 'center'}]}>
                Paga no pix aii, ganha um descontinho.
              </Text>
            </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Formas de Pagamento
          </Text>
          
          <Text style={[styles.value, { color: colors.text }]}>
            R$ {valor.toFixed(2)}
          </Text>

          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.methodButton,
                { backgroundColor: colors.background },
                selectedMethod === 'credit' && styles.selectedMethod,
                selectedMethod === 'credit' && { borderColor: colors.tint },
              ]}
              onPress={() => mudaformadepagamento('credit')}
            >
              <Ionicons
                name="card"
                size={24}
                color={selectedMethod === 'credit' ? colors.tint : colors.icon}
              />
              <Text
                style={[
                  styles.methodText,
                  { color: selectedMethod === 'credit' ? colors.tint : colors.icon },
                ]}
              >
                Cartão de Crédito
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodButton,
                { backgroundColor: colors.background },
                selectedMethod === 'pix' && styles.selectedMethod,
                selectedMethod === 'pix' && { borderColor: colors.tint },
              ]}
              onPress={() => mudaformadepagamento('pix')}
            >
              <Ionicons
                name="qr-code"
                size={24}
                color={selectedMethod === 'pix' ? colors.tint : colors.icon}
              />
              <Text
                style={[
                  styles.methodText,
                  { color: selectedMethod === 'pix' ? colors.tint : colors.icon },
                ]}
              >
                PIX
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.payButton, 
              { backgroundColor: colors.background },
              isLoading && styles.disabledButton
            ]}
            onPress={handleMercadoPagoPayment}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.payButtonText, { color: colors.text }]}>
                {selectedMethod === 'credit' ? 'Pagar com Cartão' : 'Pagar com PIX'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        ) : (
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>
              Forma de Pagamento
            </Text>
              <Text style={[styles.subtitle, { color: colors.text }]}> 
                O pagamento com verificação automática não está funcionando no momento. 
                Para garantir uma melhor experiência, estamos processando seu pagamento manualmente. 
                Você será redirecionado para a tela de pagamento PIX, onde poderá efetuar o pagamento de forma segura.
              </Text>
              <TouchableOpacity
               style={[styles.payButton, { backgroundColor: colors.background }]}
               onPress={() => router.push({pathname: '/telas_exemplo/pagamento', params: {valor: valor}})}
              >
                <Text style={[styles.payButtonText, { color: colors.text }]}>
                  Continuar com Pagamento PIX
                </Text>
              </TouchableOpacity>
          </View>
        )}
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
  modalStyle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  modalButtons: {
    width: '100%',
    gap: 10,
  },
  modalButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  choro: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 40,
  },
  methodButton: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 10,
  },
  selectedMethod: {
    borderWidth: 2,
  },
  methodText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: 'bold',
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
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
}); 