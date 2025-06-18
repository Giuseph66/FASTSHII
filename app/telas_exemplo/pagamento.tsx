import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Clipboard,
  Image,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PixQRCode, { getPayloadPronta } from '@/app/telas_exemplo/pix';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Colors } from '@/constants/Colors';
const { width, height } = Dimensions.get('window');

export default function PaymentScreen() {
  const [selectedMethod, setSelectedMethod] = useState('pix');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [installments, setInstallments] = useState('1');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const valor = parseFloat(params.valor as string) || 0;
  const chave_pix = params.chave_pix as string || '+5566999086599';
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState<string>('light');
  const [colors, setColors] = useState(Colors['light']);
  const [followSystemTheme, setFollowSystemTheme] = useState<boolean>(false);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: { text: string; style: 'default' | 'cancel' | 'destructive'; onPress: () => void }[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  // Função para atualizar o tema com base nas configurações
  const updateTheme = useCallback(async () => {
    try {
      // Verificar se deve seguir o tema do sistema
      const followSystem = await AsyncStorage.getItem('followSystemTheme');
      const shouldFollowSystem = followSystem === 'true';
      console.log('followSystemTheme carregado:', followSystem, 'shouldFollowSystem:', shouldFollowSystem);
      setFollowSystemTheme(shouldFollowSystem);
      
      if (shouldFollowSystem) {
        // Usar o tema do sistema
        const systemTheme = colorScheme === 'dark' ? 'dark' : 'light';
        console.log('Usando tema do sistema:', systemTheme, 'colorScheme:', colorScheme);
        setTheme(systemTheme);
        setColors(Colors[systemTheme]);
      } else {
        // Usar o tema personalizado
        const savedTheme = await AsyncStorage.getItem('selectedTheme');
        console.log('Tema personalizado carregado:', savedTheme);
        if (savedTheme) {
          setTheme(savedTheme);
          setColors(Colors[savedTheme as keyof typeof Colors]);
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar o tema:', error);
    }
  }, [colorScheme]);

  // Atualizar o tema quando o componente for montado ou quando o tema do sistema mudar
  useEffect(() => {
    updateTheme();
  }, [updateTheme, colorScheme]);

  // Atualizar o tema quando followSystemTheme mudar
  useEffect(() => {
    if (followSystemTheme) {
      const systemTheme = colorScheme === 'dark' ? 'dark' : 'light';
      console.log('Atualizando para tema do sistema após mudança em followSystemTheme:', systemTheme);
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

  const installmentOptions = [
    { value: '1', label: '1x sem juros' },
    { value: '2', label: '2x sem juros' },
    { value: '3', label: '3x sem juros' },
    { value: '4', label: '4x sem juros' },
    { value: '5', label: '5x sem juros' },
    { value: '6', label: '6x sem juros' },
  ];

  const calculateInstallmentValue = () => {
    const numInstallments = parseInt(installments);
    const installmentValue = valor / numInstallments;
    return installmentValue.toFixed(2);
  };

  const renderInstallmentOptions = () => {
    return installmentOptions.map((option) => {
      const numInstallments = parseInt(option.value);
      const installmentValue = valor / numInstallments;
      
      return (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.installmentOption,
            { backgroundColor: colors.background },
            installments === option.value && styles.selectedInstallment,
            installments === option.value && { borderColor: colors.tint },
          ]}
          onPress={() => setInstallments(option.value)}
        >
          <Text
            style={[
              styles.installmentText,
              { color: colors.text },
              installments === option.value && styles.selectedInstallmentText,
              installments === option.value && { color: colors.background },
            ]}
          >
            {option.label}
          </Text>
          <Text
            style={[
              styles.installmentValue,
              { color: colors.text },
              installments === option.value && styles.selectedInstallmentText,
              installments === option.value && { color: colors.background },
            ]}
          >
            R$ {installmentValue.toFixed(2)}
          </Text>
        </TouchableOpacity>
      );
    });
  };

  const pickImage = async () => {
    try {
      // Solicitar permissões para acessar a galeria e a câmera
      const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (galleryPermission.status !== 'granted' && cameraPermission.status !== 'granted') {
          return;
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      setCustomAlert({
        visible: true,
        title: 'Ocorreu um erro ao selecionar a imagem. Tente novamente.',
        message: 'Ocorreu um erro ao selecionar a imagem. Tente novamente.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
    }
  };

  const handlePayment = () => {
    setCustomAlert({
      visible: true,
      title: 'No momento, aceitamos apenas pagamentos via PIX. Deseja continuar com o pagamento via PIX?',
      message: 'No momento, aceitamos apenas pagamentos via PIX. Deseja continuar com o pagamento via PIX?',
      buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
    });
  };

  const handleReceiptUpload = async () => {
    if (!receiptImage) {
      setCustomAlert({
        visible: true,
        title: 'Por favor, selecione um comprovante de pagamento',
        message: 'Por favor, selecione um comprovante de pagamento',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
      return;
    }

    setIsLoading(true);
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      const userName = await AsyncStorage.getItem('userName');
      
      if (!userToken || !userName) {
        setCustomAlert({
          visible: true,
          title: 'Usuário não autenticado',
          message: 'Usuário não autenticado',
          buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
        });
        
        return;
      }

      // Converter a imagem para base64
      let base64Image = receiptImage;
      
      // Se a imagem não estiver em base64, convertê-la
      if (!receiptImage.startsWith('data:image')) {
        try {
          // Manipular a imagem para reduzir o tamanho e converter para base64
          const manipulatedImage = await manipulateAsync(
            receiptImage,
            [{ resize: { width: 800 } }], // Redimensionar para largura máxima de 800px
            { format: SaveFormat.JPEG, base64: true }
          );
          
          // Criar a string base64 com o prefixo de dados
          base64Image = `data:image/jpeg;base64,${manipulatedImage.base64}`;
          console.log('Imagem convertida para base64 com sucesso');
        } catch (error) {
          console.error('Erro ao converter imagem para base64:', error);
          setCustomAlert({
            visible: true,
            title: 'Não foi possível processar a imagem. Tente novamente.',
            message: 'Não foi possível processar a imagem. Tente novamente.',
            buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
          });
          setIsLoading(false);
          return;
        }
      }

      // Registrar o pagamento no Firestore
      const paymentData = {
        userId: userToken,
        userName: userName,
        amount: valor,
        method: 'pix',
        status: 'pending',
        receiptImage: base64Image, // Usar a imagem em base64
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        installments: parseInt(installments),
        pixCode: getPayloadPronta({ pago: valor }, { chave_pix }),
      };

      // Adicionar à coleção de pagamentos
      const paymentRef = await addDoc(collection(firestore, 'payments'), paymentData);

      // Atualizar o status da assinatura do usuário para 'pending'
      const userRef = doc(firestore, 'users', userToken);
      await updateDoc(userRef, {
        subscriptionStatus: 'avaliando',
        updatedAt: serverTimestamp(),
        lastPaymentId: paymentRef.id
      });
      
      // Salvar o ID do pagamento no AsyncStorage para referência
      await AsyncStorage.setItem('lastPaymentId', paymentRef.id);
      await AsyncStorage.setItem('subscriptionStatus', 'avaliando');
      
      // Sincronizar com o Firebase para atualizar o contexto
      //await syncWithFirebase();
      
      setCustomAlert({
        visible: true,
        title: 'Após a verificação do seu pagamento, sua assinatura será liberada automaticamente. Você receberá uma notificação quando isso acontecer.',
        message: 'Após a verificação do seu pagamento, sua assinatura será liberada automaticamente. Você receberá uma notificação quando isso acontecer.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => router.back() }]
      });
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setCustomAlert({
        visible: true,
        title: 'Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.',
        message: 'Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/(\d{4})(\d{4})(\d{4})(\d{4})/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    return text;
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/(\d{2})(\d{2})/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    return text;
  };

  const handleCopyPixCode = () => {
    const pixCode = getPayloadPronta({ pago: valor }, { chave_pix });
    Clipboard.setString(pixCode);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.background, colors.background]}
        style={styles.gradient}
      >
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.backgroundfraco }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Forma de Pagamento</Text>
          </View>

          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.methodButton,
                { backgroundColor: colors.backgroundfraco , display:'none'},
                selectedMethod === 'credit' && styles.selectedMethod,
                selectedMethod === 'credit' && { borderColor: colors.background },
              ]}
              onPress={() => setSelectedMethod('credit')}
            >
              <Ionicons
                name="card"
                size={24}
                color={selectedMethod === 'credit' ? colors.background : colors.icon}
              />
              <Text
                style={[
                  styles.methodText,
                  { color: selectedMethod === 'credit' ? colors.background : colors.icon },
                ]}
              >
                Cartão de Crédito
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodButton,
                { backgroundColor: colors.backgroundfraco , display:'none'},
                selectedMethod === 'debit' && styles.selectedMethod,
                selectedMethod === 'debit' && { borderColor: colors.background },
              ]}
              onPress={() => setSelectedMethod('debit')}
            >
              <Ionicons
                name="card-outline"
                size={24}
                color={selectedMethod === 'debit' ? colors.background : colors.icon}
              />
              <Text
                style={[
                  styles.methodText,
                  { color: selectedMethod === 'debit' ? colors.background : colors.icon },
                ]}
              >
                Cartão de Débito
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodButton,
                { backgroundColor: colors.backgroundfraco },
                selectedMethod === 'pix' && styles.selectedMethod,
                selectedMethod === 'pix' && { borderColor: colors.background },
              ]}
              onPress={() => setSelectedMethod('pix')}
            >
              <Ionicons
                name="qr-code"
                size={24}
                color={selectedMethod === 'pix' ? colors.background : colors.icon}
              />
              <Text
                style={[
                  styles.methodText,
                  { color: selectedMethod === 'pix' ? colors.background : colors.icon },
                ]}
              >
                PIX
              </Text>
            </TouchableOpacity>
          </View>

          {(selectedMethod === 'credit' || selectedMethod === 'debit') && (
            <View style={styles.cardForm}>
              <Text style={[styles.cardInfo, { color: colors.text }]}>
                No momento, aceitamos apenas pagamentos via PIX. Por favor, selecione a opção PIX para continuar com seu pagamento.
              </Text>
              <TouchableOpacity
                style={[styles.pixRedirectButton, { backgroundColor: colors.background }]}
                onPress={() => setSelectedMethod('pix')}
              >
                <Ionicons name="qr-code" size={24} color={colors.text} />
                <Text style={[styles.pixRedirectButtonText, { color: colors.text }]}>Ir para PIX</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedMethod === 'credit' && (
            <View style={styles.cardForm}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                placeholder="Número do Cartão"
                placeholderTextColor={colors.icon}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                keyboardType="numeric"
                maxLength={19}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                placeholder="Nome no Cartão"
                placeholderTextColor={colors.icon}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="characters"
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                  placeholder="MM/AA"
                  placeholderTextColor={colors.icon}
                  value={expiryDate}
                  onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.input, styles.halfInput, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                  placeholder="CVV"
                  placeholderTextColor={colors.icon}
                  value={cvv}
                  onChangeText={setCvv}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <Text style={[styles.installmentTitle, { color: colors.text }]}>Parcelas</Text>
              <View style={styles.installmentOptions}>
                {renderInstallmentOptions()}
              </View>
              <TouchableOpacity
                style={[styles.payButton, { backgroundColor: colors.background }]}
                onPress={handlePayment}
              >
                <Text style={[styles.payButtonText, { color: colors.text }]}>
                  {installments === '1' 
                    ? `Pagar R$ ${valor.toFixed(2)}`
                    : `Pagar ${installments}x de R$ ${calculateInstallmentValue()}`
                  }
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedMethod === 'debit' && (
            <View style={styles.cardForm}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                placeholder="Número do Cartão"
                placeholderTextColor={colors.icon}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                keyboardType="numeric"
                maxLength={19}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                placeholder="Nome no Cartão"
                placeholderTextColor={colors.icon}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="characters"
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                  placeholder="MM/AA"
                  placeholderTextColor={colors.icon}
                  value={expiryDate}
                  onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.input, styles.halfInput, { backgroundColor: colors.backgroundfraco, color: colors.text }]}
                  placeholder="CVV"
                  placeholderTextColor={colors.icon}
                  value={cvv}
                  onChangeText={setCvv}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <TouchableOpacity
                style={[styles.payButton, { backgroundColor: colors.background }]}
                onPress={handlePayment}
              >
                <Text style={[styles.payButtonText, { color: colors.text }]}>
                  Pagar R$ {valor.toFixed(2)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedMethod === 'pix' && (
            <View style={styles.pixContainer}>
              <Text style={[styles.pixText, { color: colors.text }]}>
                Valor a ser pago: R$ {valor.toFixed(2)}
              </Text>             
               <View style={[styles.qrCodeContainer, { backgroundColor: colors.backgroundfraco }]}>
                <PixQRCode 
                  trabalho={{ pago: valor }} 
                  usuario={{ chave_pix }} 
                />
              </View>
              <Text style={[styles.pixText, { color: colors.text }]}>
                Escaneie o QR Code ou copie o código PIX abaixo:
              </Text>
              <View style={[styles.pixCodeContainer, { backgroundColor: colors.backgroundfraco }]}>
                <Text style={[styles.pixCode, { color: colors.text }]}>
                {getPayloadPronta({ pago: valor }, { chave_pix })} </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyPixCode}
                >
                  <Ionicons name="copy" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.receiptContainer, { backgroundColor: colors.backgroundfraco }]}>
                <Text style={[styles.receiptTitle, { color: colors.text }]}>Comprovante de Pagamento</Text>
                <TouchableOpacity 
                  style={[styles.uploadButton, { backgroundColor: colors.background }]}
                  onPress={pickImage}
                  disabled={isLoading}
                >
                  <Ionicons name="cloud-upload" size={24} color={colors.text} />
                  <Text style={[styles.uploadButtonText, { color: colors.text }]}>
                    {receiptImage ? 'Trocar Comprovante' : 'Selecionar Comprovante'}
                  </Text>
                </TouchableOpacity>
                
                {receiptImage && (
                  <>
                    <Image 
                      source={{ uri: receiptImage }} 
                      style={styles.receiptImage}
                    />
                    <TouchableOpacity
                      style={[
                        styles.confirmButton, 
                        { backgroundColor: colors.background },
                        isLoading && styles.disabledButton
                      ]}
                      onPress={handleReceiptUpload}
                      disabled={isLoading}
                    >
                      <Text style={[styles.confirmButtonText, { color: colors.text }]}>
                        {isLoading ? 'Processando...' : 'Já tá pago'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    alignSelf: 'center',
    top: height * 0.02,
  },
  paymentMethods: {
    marginTop: height * 0.02,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  methodButton: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  selectedMethod: {
    borderWidth: 1,
  },
  methodText: {
    marginTop: 5,
    fontSize: 12,
  },
  cardForm: {
    padding: 20,
  },
  input: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  pixContainer: {
    alignItems: 'center',
    padding: 20,
  },
  qrCodeContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  pixText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  pixCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    width: '100%',
  },
  pixCode: {
    flex: 1,
    fontSize: 12,
  },
  copyButton: {
    padding: 10,
  },
  payButton: {
    padding: 20,
    borderRadius: 12,
    margin: 20,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptContainer: {
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  uploadButtonText: {
    marginLeft: 10,
    fontSize: 16,
  },
  receiptImage: {
    width: width * 0.8,
    height: width * 0.6,
    borderRadius: 12,
    marginBottom: 15,
  },
  confirmButton: {
    padding: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardInfo: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    padding: 15,
    borderRadius: 12,
  },
  pixRedirectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  pixRedirectButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  installmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  installmentOptions: {
    marginBottom: 20,
  },
  installmentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  selectedInstallment: {
    borderWidth: 1,
  },
  installmentText: {
    fontSize: 14,
  },
  installmentValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedInstallmentText: {
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
