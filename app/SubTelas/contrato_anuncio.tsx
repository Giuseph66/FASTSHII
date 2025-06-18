import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  Dimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, updateDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';
import DatePicker from '@/components/DatePicker';
import { comoFunciona } from '@/contextos/como_funciona';
import { termosContrato } from '@/contextos/termos_contrato';
import { createPreference } from '@/config/mercadoPago';
import * as WebBrowser from 'expo-web-browser';

const windowWidth = Dimensions.get('window').width;

interface ContractForm {
  advertiserName: string;
  advertiserEmail: string;
  advertiserPhone: string;
  advertiserCNPJ: string;
  adTitle: string;
  adDescription: string;
  startDate: Date;
  endDate: Date;
  budget: string;
  targetAudience: string;
  paymentMethod: string;
  terms: boolean;
  images: string[];
  links: string[];
}

const MAX_ANNOUNCEMENT_DURATION = 90; // Duração máxima em dias

const ContratoAnuncioScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any>(null);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [isModalOrcamentoVisible, setIsModalOrcamentoVisible] = useState(false);
  const [selectedReach, setSelectedReach] = useState(1000);
  const [customReach, setCustomReach] = useState('');
  const [calculatedBudget, setCalculatedBudget] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [visualizacoes, setvisualizacoes] = useState(0);
  const customReachRef = useRef<TextInput>(null);
  const [form, setForm] = useState<ContractForm>({
    advertiserName: '',
    advertiserEmail: '',
    advertiserPhone: '',
    advertiserCNPJ: '',
    adTitle: '',
    adDescription: '',
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
    budget: calculatedBudget.toFixed(2),
    targetAudience: '',
    paymentMethod: 'pix',
    terms: false,
    images: [],
    links: [],
  });
  const [isHowItWorksModalVisible, setIsHowItWorksModalVisible] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUsuario(JSON.parse(userData));
      }
      const usuarios = await getDocs(collection(firestore, 'usuarios'));
      const usersList = usuarios.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsuarios(usersList);
      setTotalUsers(usersList.length);
    };
    fetchUser();
  }, []);

  // Efeito para calcular o orçamento inicial
  useEffect(() => {
    const duration = Math.ceil((form.endDate.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const initialBudget = calculateBudget(selectedReach, duration);
    setCalculatedBudget(initialBudget);
    setForm(prev => ({ ...prev, budget: initialBudget.toFixed(2) }));
  }, [form.startDate, form.endDate]);

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const compressedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1080 } }],
          { format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (compressedImage.base64) {
          const base64String = compressedImage.base64;
          setForm(prev => ({
            ...prev,
            images: [...prev.images, base64String]
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
        setCustomAlert({
          visible: true,
        title: 'Erro',
        message: 'Erro ao selecionar imagem: ' + (error as Error).message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }
  };

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const addLink = () => {
    if (form.links.length >= 3) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Você atingiu o limite de 3 links',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return
    }
    if (newLink.trim()) {
      if (newLink.trim().startsWith('http')) {
      setForm(prev => ({
        ...prev,
          links: [...prev.links, newLink.trim()]
        }));
        setNewLink('');
      } else {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Link inválido, por favor, insira um link válido',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
      }
    }
  };

  const removeLink = (index: number) => {
    setForm(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Usuário não autenticado',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      const user = JSON.parse(userData);

      // Cálculo de dados adicionais
      const durationDays = Math.ceil((form.endDate.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));

      const contractData = {
        ...form,
        userId: user.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reachPerDay: selectedReach,
        durationDays: durationDays,
        totalBudget: calculatedBudget,
      };

      // Salvar contrato
      const contractRef = await addDoc(collection(firestore, 'advertising_contracts'), contractData);

      // Atualizar documento do usuário com segurança para casos onde "contracts" ainda não existe
      const existingContracts = Array.isArray(user.contracts) ? user.contracts : [];
      await updateDoc(doc(firestore, 'usuarios', user.uid), {
        contracts: [...existingContracts, contractRef.id],
        empresa: {
          cnpj: contractData.advertiserCNPJ,
          nome: contractData.advertiserName,
          email: contractData.advertiserEmail,
          telefone: contractData.advertiserPhone,
        },
      });
      const webhookUrl = "https://pag.neurelix.com.br";
      const paymentMethodsConfig = {
        installments: 1,
        default_payment_method_id: form.paymentMethod === 'pix' ? 'pix' : 'credit_card',
        excluded_payment_types: form.paymentMethod === 'pix'
          ? [ { id: 'credit_card' }, { id: 'debit_card' }, { id: 'atm' } ]
          : [ { id: 'pix' }, { id: 'debit_card' }, { id: 'bank_transfer' }, { id: 'atm' } ],
      };
      const preferenceData = {
        items: [
          {
            title: "pagamento do anuncio no Fastshii",
            quantity: 1,
            currency_id: "BRL",
            unit_price: parseFloat(form.budget)
          }
        ],
        payer: {
          email: form.advertiserEmail,
        },
        back_urls: {
          success: `${webhookUrl}/success`,
          failure: `${webhookUrl}/failure`,
          pending: `${webhookUrl}/pending`
        },
        auto_return: "approved",
        external_reference: {
          app : "fastshii",
          valor: parseFloat(form.budget),
          userId: user.uid,
          contractId: contractRef.id,
          tipo: 'contrato',
          createdAt: serverTimestamp(),
        }, 
        payment_methods: paymentMethodsConfig,
        webhook_url: `${webhookUrl}/webhook`
      };
      console.log('preferenceData', preferenceData);
      const preference = await createPreference(preferenceData);
      const result = await WebBrowser.openBrowserAsync(preference.init_point);
      console.log('Resultado do pagamento:', result);
      console.log('ignorado');

      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: 'Contrato enviado com sucesso!',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      await updateDoc(doc(firestore, 'usuarios', user.uid), {
        empresa : [ contractData.advertiserCNPJ , contractData.advertiserName, contractData.advertiserEmail, contractData.advertiserPhone]
      });
      router.back();
    } catch (error: any) {
      console.error('Erro ao enviar contrato:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível enviar o contrato: ' + (error as Error).message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const missingFields = [];

    if (!form.advertiserName) missingFields.push('Nome/Razão Social');
    if (!form.advertiserEmail) missingFields.push('E-mail');
    if (!form.advertiserPhone) missingFields.push('Telefone');
    if (!form.advertiserCNPJ) missingFields.push('CNPJ');
    if (!form.adTitle) missingFields.push('Título do Anúncio');
    if (!form.adDescription) missingFields.push('Descrição do Anúncio');
    if (!form.budget) missingFields.push('Orçamento');
    if (!form.targetAudience) missingFields.push('Público-Alvo');
    if (!form.paymentMethod) missingFields.push('Método de Pagamento');
    if (!form.terms) missingFields.push('Termos e Condições');
    if (!form.startDate) missingFields.push('Data de Início');
    if (!form.endDate) missingFields.push('Data de Término');
    if (!form.images || form.images.length === 0) missingFields.push('Imagens do Anúncio');
    if (!form.links || form.links.length === 0) missingFields.push('Links do Anúncio');
    if (form.advertiserCNPJ.length !== 14) missingFields.push('CNPJ incompleto');

    // Validação de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.advertiserEmail && !emailRegex.test(form.advertiserEmail)) {
      setCustomAlert({
        visible: true,
        title: 'E-mail inválido',
        message: 'Por favor, insira um endereço de e-mail válido.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return false;
    }
    
    if (missingFields.length > 0) {
      const message = `Por favor, preencha os seguintes campos:\n\n${missingFields.join('\n')}`;
      setCustomAlert({
        visible: true,
        title: 'Campos Obrigatórios',
        message: message,
        buttons: [
          { 
            text: 'OK', 
            style: 'default', 
            onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) 
          }
        ]
      });
      return false;
    }
    return true;
  };

  const openModal = () => {
    setIsModalVisible(true);
  };

  const handleCNPJChange = (text: string) => {
    // Remove caracteres não numéricos
    const cnpj = text.replace(/\D/g, '');
    
    // Atualiza o CNPJ no form (mantém apenas números para validação)
    setForm(prev => ({ ...prev, advertiserCNPJ: cnpj }));

    // Se o CNPJ tiver 14 dígitos, faz a validação
    if (cnpj.length === 14) {
      buscarDadosCNPJ(cnpj);
    }
  };

  const formatCNPJ = (cnpj: string) => {
    // Remove caracteres não numéricos
    const numbers = cnpj.replace(/\D/g, '');
    
    // Aplica a máscara
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 5) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    } else if (numbers.length <= 8) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    } else if (numbers.length <= 12) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    } else {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
    }
  };

  const buscarDadosCNPJ = async (cnpj: string) => {
    // Verifica se já está carregando para evitar múltiplas requisições
    if (loadingCNPJ) return;

    try {
      setLoadingCNPJ(true);
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = await response.json();

      if (!data.razao_social) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'CNPJ inválido ou não encontrado',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        setForm(prev => ({ ...prev, advertiserCNPJ: '', advertiserName: '', advertiserEmail: '', advertiserPhone: '' }));
      } else {
        // Preenche automaticamente os campos com os dados do CNPJ
        setForm(prev => ({
          ...prev,
          advertiserName: data.razao_social || prev.advertiserName,
          advertiserEmail: data.email || prev.advertiserEmail,
          advertiserPhone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0,2)}) ${data.ddd_telefone_1.slice(2)}` : prev.advertiserPhone,
        }));

        setCustomAlert({
          visible: true,
          title: 'Sucesso',
          message: 'CNPJ validado com sucesso!',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao validar CNPJ. Tente novamente.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const calculateBudget = (reach: number, duration: number) => {
    // CPV base
    let CPV = 0.01;

    // Cálculo do custo base
    const baseCost = reach * CPV;
    // Cálculo do custo total
    const totalCost = baseCost * duration;

    // Arredonda para 2 casas decimais
    return Math.round(totalCost * 100) / 100;
  };

  const handlePaymentMethodChange = (method: string) => {
    const baseBudget = parseFloat(form.budget);
    let finalBudget = baseBudget;

    if (method === 'credit_card') {
      // Adiciona 5% de taxa para cartão de crédito
      finalBudget = baseBudget * 1.05;
    }

    setForm(prev => ({
      ...prev,
      paymentMethod: method,
      budget: finalBudget.toFixed(2)
    }));
  };

  const handleReachChange = (reach: number) => {
    setvisualizacoes(reach)
    setSelectedReach(reach);
    setCustomReach('');
    // Calcula a duração em dias entre as datas de início e fim
    const duration = Math.ceil((form.endDate.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const budget = calculateBudget(reach, duration);
    setCalculatedBudget(budget);
    setForm(prev => ({ ...prev, budget: budget.toFixed(2) }));
  };

  const handleCustomReachChange = (text: string) => {
    // Remove caracteres não numéricos
    const numericValue = text.replace(/\D/g, '');
    setCustomReach(numericValue);
    setvisualizacoes(parseInt(numericValue));
    if (numericValue) {
      const reach = parseInt(numericValue);
      const maxGuaranteedReach = totalUsers * 5;

      if (reach > maxGuaranteedReach) {
        setCustomAlert({
          visible: true,
          title: 'Alcance Personalizado',
          message: `O alcance máximo previsto é de ${maxGuaranteedReach} visualizações.\n\nVocê pode definir um valor maior, mas não podemos garantir que todas as visualizações serão atingidas.`,
          buttons: [
            { 
              text: 'Entendi', 
              style: 'default', 
              onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) 
            }
          ]
        });
      }

      setSelectedReach(reach);
      const duration = Math.ceil((form.endDate.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const budget = calculateBudget(reach, duration);
      setCalculatedBudget(budget);
      setForm(prev => ({ ...prev, budget: budget.toFixed(2) }));
    }
  };

  const handleStartDateChange = (date: Date) => {
    // Se a data de término for anterior ou igual à nova data de início, ajusta para o dia seguinte
    const newEndDate = form.endDate <= date ? new Date(date.getTime() + 24 * 60 * 60 * 1000) : form.endDate;
    
    // Verifica se a nova data de término excede o limite máximo
    const maxEndDate = new Date(date.getTime() + MAX_ANNOUNCEMENT_DURATION * 24 * 60 * 60 * 1000);
    if (newEndDate > maxEndDate) {
      setCustomAlert({
        visible: true,
        title: 'Duração Máxima',
        message: `O anúncio não pode ter duração superior a ${MAX_ANNOUNCEMENT_DURATION} dias.`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    setForm(prev => ({ 
      ...prev, 
      startDate: date,
      endDate: newEndDate
    }));
  };

  const handleEndDateChange = (date: Date) => {
    // Verifica se a data de término é pelo menos um dia depois da data de início
    if (date <= form.startDate) {
      setCustomAlert({
        visible: true,
        title: 'Data Inválida',
        message: 'A data de término deve ser pelo menos um dia após a data de início.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    // Verifica se a duração excede o limite máximo
    const duration = Math.ceil((date.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (duration > MAX_ANNOUNCEMENT_DURATION) {
      setCustomAlert({
        visible: true,
        title: 'Duração Máxima',
        message: `O anúncio não pode ter duração superior a ${MAX_ANNOUNCEMENT_DURATION} dias.`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    setForm(prev => ({ ...prev, endDate: date }));
  };

  const fecha_modal_orcamento = () => {
    const maxGuaranteedReach = totalUsers * 5;
    if (visualizacoes > maxGuaranteedReach) {
      setCustomAlert({
        visible: true,
        title: 'Alcance Máximo',
        message: `O alcance máximo previsto é de ${maxGuaranteedReach} visualizações. Não nos responsabilizamos por resultados abaixo do valor que você definiu.`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }else if (visualizacoes < 10) {
      setCustomAlert({
        visible: true,
        title: 'Alcance Mínimo',
        message: `O alcance mínimo é de 10 visualizações.`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => {
            setCustomAlert(prev => ({ ...prev, visible: false }));
          }
          }
        ]
      });

      return;
    }
    customReachRef.current?.focus();
    setIsModalOrcamentoVisible(false);

  };

  const renderOrcamentoModal = () => {
    const duration = Math.ceil((form.endDate.getTime() - form.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxGuaranteedReach = totalUsers * 5;

    return (
      <Modal
        visible={isModalOrcamentoVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={[styles.modalOrcamentoOverlay]}>
          <View style={[styles.modalOrcamentoContent, { 
            backgroundColor: colorScheme === 'dark' ? themeColors.background : 'white',
          }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000' 
                }]}>
                  Orçamento e Alcance
                </Text>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={fecha_modal_orcamento}
                >
                  <Ionicons 
                    name="close" 
                    size={24} 
                    color={colorScheme === 'dark' ? themeColors.googleButton : '#000'} 
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.infoContainer, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }]}>
                <Text style={[styles.infoText, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#333' 
                }]}>
                  Total de usuários ativos: {totalUsers}
                </Text>
                <Text style={[styles.infoText, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#333',
                  marginTop: 5,
                }]}>
                  Alcance máximo previsto: {maxGuaranteedReach} visualizações
                </Text>
                <Text style={[styles.infoText, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#333',
                  marginTop: 5,
                }]}>
                  Duração da campanha: {duration} dias
                </Text>
                <Text style={[styles.infoText, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#333',
                  marginTop: 5,
                }]}>
                  Período: {form.startDate.toLocaleDateString()} - {form.endDate.toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000' 
                }]}>
                  Alcance Desejado (Por dia)
                </Text>
                <View style={styles.reachOptions}>
                  {[100, 500, 1000, 5000].map((reach) => (
                    <TouchableOpacity
                      key={reach}
                      style={[
                        styles.reachButton,
                        { 
                          backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                          borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        },
                        selectedReach === reach && {backgroundColor: themeColors.tint, borderColor: themeColors.tint}
                      ]}
                      onPress={() => handleReachChange(reach)}
                    >
                      <Text style={[
                        styles.reachText,
                        { color: colorScheme === 'dark' ? themeColors.googleButton : '#333' },
                        selectedReach === reach && styles.selectedText
                      ]}>
                        {reach} visualizações
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <View style={styles.customReachContainer}>
                  <Text style={[styles.customReachLabel, { 
                    color: colorScheme === 'dark' ? themeColors.googleButton : '#333' 
                  }]}>
                    Ou digite um valor personalizado:
                  </Text>
                  <TextInput
                    style={[styles.customReachInput, { 
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? themeColors.googleButton : '#333',
                      borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }]}
                    placeholder={`Máximo previsto: ${maxGuaranteedReach} visualizações`}
                    placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                    keyboardType="numeric"
                    ref={customReachRef}
                    value={customReach}
                    onChangeText={handleCustomReachChange}
                  />
                  <Text style={[styles.reachWarning, { 
                    color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                    fontSize: 12,
                    marginTop: 5,
                  }]}>
                    * Valores acima de {maxGuaranteedReach} visualizações não são garantidos
                  </Text>
                </View>
              </View>

              <View style={[styles.summaryContainer, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }]}>
                <Text style={[styles.summaryTitle, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000' 
                }]}>
                  Resumo do Orçamento
                </Text>
                <View style={styles.summaryRow}>
                  <Text style={{ color: colorScheme === 'dark' ? themeColors.googleButton : '#333' }}>Duração:</Text>
                  <Text style={{ color: colorScheme === 'dark' ? themeColors.googleButton : '#333' }}>{duration} dias</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={{ color: colorScheme === 'dark' ? themeColors.googleButton : '#333' }}>Alcance:</Text>
                  <Text style={{ color: colorScheme === 'dark' ? themeColors.googleButton : '#333' }}>{selectedReach} visualizações</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={{ color: colorScheme === 'dark' ? themeColors.googleButton : '#333' }}>Custo por visualização:</Text>
                  <Text style={{ color: colorScheme === 'dark' ? themeColors.googleButton : '#333' }}>R$ 0,01</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.totalText, { 
                    color: colorScheme === 'dark' ? themeColors.googleButton : '#000' 
                  }]}>
                    Total:
                  </Text>
                  <Text style={[styles.totalValue, { 
                    color: colorScheme === 'dark' ? themeColors.googleButton : themeColors.tint 
                  }]}>
                    R$ {calculatedBudget.toFixed(2)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: themeColors.tint }]}
                onPress={fecha_modal_orcamento}
              >
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderHowItWorksModal = () => {
    return (
      <Modal
        visible={isHowItWorksModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setIsHowItWorksModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={'#000'} />
            </TouchableOpacity>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { 
                color: '#000',
                fontSize: 24,
                marginBottom: 20,
              }]}>
                📢 Como Funciona a Criação de um Anúncio?
              </Text>

              {comoFunciona.map((section, index) => (
                <View key={index} style={styles.howItWorksSection}>
                  <Text style={[styles.howItWorksSectionTitle, { color: '#000' }]}>
                    {section.title}
                  </Text>
                  {section.description && (
                    <Text style={[styles.howItWorksText, { color: '#000' }]}>
                      {section.description}
                    </Text>
                  )}
                  <View style={styles.bulletPoints}>
                    {section.items.map((item, itemIndex) => (
                      <Text key={itemIndex} style={[styles.bulletPoint, { color: '#000' }]}>
                        • {item}
                      </Text>
                    ))}
                    {section.subItems && (
                      <View style={styles.subBulletPoints}>
                        {section.subItems.map((subItem, subItemIndex) => (
                          <Text key={subItemIndex} style={[styles.subBulletPoint, { color: '#000' }]}>
                            - {subItem}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color={'#000'} />
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Termos e Condições</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {termosContrato.map((item, index) => (
                  <View key={index} style={styles.termBlock}>
                    <Text style={styles.modalTextBold}>{item.title}</Text>
                    <Text style={styles.modalText}>{item.desc}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: 'transparent' }]}>
          <View style={styles.appBarLeft}>
          <TouchableOpacity 
            onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}
          >
              <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: themeColors.googleButton }]}>Contrato de Anúncio</Text>
          </View>

          <View style={styles.appBarRight}>
            <TouchableOpacity 
              onPress={() => setIsHowItWorksModalVisible(true)}
              style={styles.helpButton}
            >
              <Ionicons name="help-circle" size={20} color="#fff" />
              <Text style={{color: '#fff', fontSize: 14, fontWeight: 'bold'}}>Como funciona?</Text>
              <Ionicons name="help-circle" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            {/* Informações do Anunciante */}
            <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
              Informações do Anunciante
            </Text>
            <View style={styles.cnpjContainer}>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  flex: 1,
                }]}
                placeholder="CNPJ (XX.XXX.XXX/XXXX-XX)"
                placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                keyboardType="numeric"
                value={formatCNPJ(form.advertiserCNPJ)}
                onChangeText={handleCNPJChange}
                maxLength={18} // 14 dígitos + 4 caracteres especiais
              />
              {loadingCNPJ && (
                <ActivityIndicator 
                  style={styles.cnpjLoading} 
                  color={themeColors.googleButton} 
                />
              )}
            </View>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Nome/Razão Social"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              value={form.advertiserName}
              onChangeText={(text) => setForm({ ...form, advertiserName: text })}
            />

            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="E-mail"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              keyboardType="email-address"
              value={form.advertiserEmail}
              onChangeText={(text) => setForm({ ...form, advertiserEmail: text })}
            />

            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Telefone"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              keyboardType="phone-pad"
              value={form.advertiserPhone}
              onChangeText={(text) => setForm({ ...form, advertiserPhone: text })}
            />


            {/* Detalhes do Anúncio */}
            <Text style={[styles.sectionTitle, { 
              color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
              marginTop: 30,
            }]}>
              Detalhes do Anúncio
            </Text>

            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Título do Anúncio"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              value={form.adTitle}
              onChangeText={(text) => setForm({ ...form, adTitle: text })}
            />

            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Descrição do Anúncio"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              multiline
              numberOfLines={4}
              value={form.adDescription}
              onChangeText={(text) => setForm({ ...form, adDescription: text })}
            />

            {/* Datas */}
            <View style={styles.dateContainer}>
              <DatePicker
                value={form.startDate}
                onChange={handleStartDateChange}
                label="Data de Início"
                minimumDate={new Date(form.startDate.getTime() - 24 * 60 * 60 * 1000)}
              />

              <DatePicker
                value={form.endDate}
                onChange={handleEndDateChange}
                label="Data de Término"
                minimumDate={new Date()}
                maxDuration={MAX_ANNOUNCEMENT_DURATION}
              />
            </View>

            {/* Orçamento e Público */}
              <TouchableOpacity
              style={[styles.botaoOrcamentoContainer, { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }]} 
              onPress={() => setIsModalOrcamentoVisible(true)}
            >
              <Text style={{color: colorScheme === 'dark' ? themeColors.googleButton : '#000'}}>
                Orçamento
                </Text>
              <Text style={{color: colorScheme === 'dark' ? themeColors.googleButton : '#000'}}>
                R$ {form.budget || '0,00'}
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={24} 
                color={colorScheme === 'dark' ? themeColors.googleButton : '#000'} 
              />
              </TouchableOpacity>

            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Público-Alvo"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              multiline
              numberOfLines={3}
              value={form.targetAudience}
              onChangeText={(text) => setForm({ ...form, targetAudience: text })}
            />

            {/* Método de Pagamento */}
            <View style={styles.paymentContainer}>
              <Text style={[styles.sectionTitle, { 
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
              }]}>
                Método de Pagamento
              </Text>
              <View style={styles.paymentOptions}>
                <TouchableOpacity
                  style={[
                    styles.paymentButton,
                    { 
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    },
                    form.paymentMethod === 'pix' && {backgroundColor: themeColors.tint, borderColor: themeColors.tint}
                  ]}
                  onPress={() => handlePaymentMethodChange('pix')}
                >
                  <Text style={[
                    styles.paymentText,
                    { color: colorScheme === 'dark' ? themeColors.googleButton : '#333' },
                    form.paymentMethod === 'pix' && styles.selectedText
                  ]}>
                    PIX
                  </Text>
                </TouchableOpacity>
                {/*
                <TouchableOpacity
                  style={[
                    styles.paymentButton,
                    { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    },
                    form.paymentMethod === 'credit_card' && {backgroundColor: themeColors.tint, borderColor: themeColors.tint}
                  ]}
                  onPress={() => handlePaymentMethodChange('credit_card')}
                >
                  <Text style={[
                    styles.paymentText,
                    { color: colorScheme === 'dark' ? themeColors.googleButton : '#333' },
                    form.paymentMethod === 'credit_card' && styles.selectedText
                  ]}>
                    Cartão de Crédito (+5%)
                  </Text>
                </TouchableOpacity>*/}
              </View>
            </View>

            {/* Imagens do Anúncio */}
            <Text style={[styles.sectionTitle, { 
              color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
              marginTop: 30,
            }]}>
              Imagens do Anúncio
            </Text>

            <View style={styles.imagesContainer}>
              {form.images.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${image}` }}
                    style={styles.thumbnail}
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ff0000" />
                  </TouchableOpacity>
                </View>
              ))}
              {form.images.length < 5 && (
                <TouchableOpacity
                  style={[styles.addImageButton, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  onPress={handleImagePicker}
                >
                  <Ionicons 
                    name="add-circle-outline" 
                    size={32} 
                    color={colorScheme === 'dark' ? themeColors.googleButton : '#000'} 
                  />
                  <Text style={[styles.addImageText, { 
                    color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                  }]}>
                    Adicionar Imagem
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Links do Anúncio */}
            <Text style={[styles.sectionTitle, { 
              color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
              marginTop: 30,
            }]}>
              Links do Anúncio
            </Text>

            <View style={styles.linksContainer}>
              {form.links.map((link, index) => (
                <View key={index} style={styles.linkItem}>
                  <Text style={[styles.linkText, { 
                    color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                  }]}>
                    {link}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeLinkButton}
                    onPress={() => removeLink(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ff0000" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addLinkContainer}>
                <TextInput
                  style={[styles.linkInput, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  placeholder="Adicionar link"
                  placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                  value={newLink}
                  onChangeText={setNewLink}
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={[styles.addLinkButton, { backgroundColor: themeColors.tint }]}
                  onPress={addLink}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Termos e Condições */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => {
                setForm({ ...form, terms: !form.terms });
                openModal();
              }}
            >
              <View style={[styles.checkbox, { 
                borderColor: colorScheme === 'dark' ? '#fff' : '#000',
                backgroundColor: form.terms ? themeColors.tint : 'transparent',
              }]}>
                {form.terms && <Ionicons name="checkmark" size={20} color="#fff" />}
              </View>
              <Text style={[styles.termsText, { 
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
              }]}>
                Li e concordo com os termos e condições do contrato de anúncio
              </Text>
              <TouchableOpacity onPress={() => openModal()}>
                <Ionicons name="information-circle" size={20} color={themeColors.googleButton} />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Botão de Envio */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: themeColors.tint }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar Contrato</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {renderOrcamentoModal()}
        {renderHowItWorksModal()}
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          buttons={customAlert.buttons}
          onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
        />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default ContratoAnuncioScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  appBar: {
    top: StatusBar.currentHeight,
    left: 0,
    right: 0,
    minHeight: 56,
    height: 'auto',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  termBlock: {
    marginBottom: 12,
  },
  
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalTextBold: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalInfo: {
    fontSize: 16,
  },
  modalText: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  dateContainer: {
    marginBottom: 12,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
  },
  submitButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  linksContainer: {
    marginBottom: 20,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
  },
  removeLinkButton: {
    marginLeft: 8,
  },
  addLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkInput: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  addLinkButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cnpjContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cnpjLoading: {
    marginLeft: 10,
  },
  botaoOrcamentoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  modalOrcamentoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOrcamentoContent: {
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  reachOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  reachButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    width: '48%',
  },
  reachText: {
    textAlign: 'center',
  },
  selectedText: {
    color: 'white',
  },
  summaryContainer: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  customReachContainer: {
    marginTop: 15,
  },
  customReachLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  customReachInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  reachWarning: {
    textAlign: 'center',
  },
  paymentContainer: {
    marginBottom: 20,
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  paymentButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  paymentText: {
    fontSize: 16,
    fontWeight: '500',
  },
  howItWorksSection: {
    marginBottom: 20,
  },
  howItWorksSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  howItWorksText: {
    fontSize: 16,
    marginBottom: 10,
  },
  bulletPoints: {
    marginLeft: 10,
  },
  bulletPoint: {
    fontSize: 16,
    marginBottom: 8,
  },
  subBulletPoints: {
    marginLeft: 20,
    marginTop: 5,
    marginBottom: 5,
  },
  subBulletPoint: {
    fontSize: 16,
    marginBottom: 5,
  },
  helpButton: {
    backgroundColor: 'rgba(49, 49, 49, 0.3)',
      borderRadius: 10,
      paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
}); 