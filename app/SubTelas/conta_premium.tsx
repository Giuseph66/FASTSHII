/* eslint-disable no-use-before-define */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CustomAlert from '@/components/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPreference } from '@/config/mercadoPago';
import * as WebBrowser from 'expo-web-browser';

type PlanType = 'enhanced' | 'adfree' | 'combo' | 'n';

interface Plan {
  id: PlanType;
  title: string;
  price: string;
  period: string;
  features: string[];
  icon: string;
  description: string;
  conta: string;
}

const PremiumScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('enhanced');
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });

  const plans: Record<PlanType, Plan> = {
    enhanced: {
      id: 'enhanced',
      title: 'Uso Melhorado',
      price: 'R$ 19,90',
      period: 'mês',
      icon: 'rocket',
      conta: 'M',
      description: 'Recursos avançados para melhorar sua experiência',
      features: [
        'Alcance ampliado em anúncios',
        'Estatísticas detalhadas',
        'Personalização avançada',
        'Suporte prioritário',
        'Acesso a recursos beta'
      ]
    },
    adfree: {
      id: 'adfree',
      title: 'Sem Anúncios',
      price: 'R$ 14,90',
      period: 'mês',
      icon: 'close-circle',
      conta: 'A',
      description: 'Navegue sem interrupções',
      features: [
        'Remoção de todos os anúncios',
        'Navegação mais rápida',
        'Economia de dados',
        'Interface mais limpa',
        'Menor consumo de bateria'
      ]
    },
    combo: {
      id: 'combo',
      title: 'Combo Premium',
      price: 'R$ 29,90',
      period: 'mês',
      icon: 'star',
      conta: 'C',
      description: 'O melhor dos dois mundos',
      features: [
        'Todas as features do Uso Melhorado',
        'Todas as features do Sem Anúncios',
        'Desconto de 25%',
        'Acesso antecipado a novos recursos',
        'Consultoria personalizada'
      ]
    },
    n: {
      id: 'n',
      title: 'Gratuito',
      price: 'R$ 0,00',
      period: '',
      icon: 'leaf',
      conta: 'N',
      description: 'Plano gratuito básico com anúncios',
      features: [
        'Acesso limitado',
        'Exibição de anúncios',
        'Acesso a recursos básicos'
      ],
    },
  };

  const handleSubscribe = () => {
    setCustomAlert({
      visible: true,
      title: 'Assinatura Premium',
      message: 'Você será redirecionado para a página de pagamento. Deseja continuar?',
      buttons: [
        { 
          text: 'Cancelar', 
          style: 'cancel',
          onPress: () => setCustomAlert((prev: any) => ({ ...prev, visible: false }))
        },
        { 
          text: 'Continuar',
          style: 'default',
          onPress: () => {
            setCustomAlert((prev: any) => ({ ...prev, visible: false }));
            // Aqui você implementaria a integração com o gateway de pagamento
            console.log('Processando pagamento para o plano:', selectedPlan);
            pagar(selectedPlan);
          }
        }
      ]
    });
    };
    const pagar = async (plano : string) => {
      const plano_valor_str = plans[plano as PlanType].price;
      const plano_nome = plans[plano as PlanType].title;
      const plano_conta = plans[plano as PlanType].conta;

      const plano_valor = parseFloat(plano_valor_str.replace(/[^0-9,.-]/g, '').replace(',', '.'));

      const user = await AsyncStorage.getItem('user');
      if (!user) return;
      const userData = JSON.parse(user);
      const selectedPlan = 'pix';
      const webhookUrl = "https://pag.neurelix.com.br";
      const paymentMethodsConfig = {
        installments: 1,
        default_payment_method_id: selectedPlan === 'pix' ? 'pix' : 'credit_card',
        excluded_payment_types: selectedPlan === 'pix'
          ? [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'atm' }]
          : [{ id: 'pix' }, { id: 'debit_card' }, { id: 'bank_transfer' }, { id: 'atm' }],
      };
      const preferenceData = {
        items: [
          {
            title: "Assinatura Premium Fastshii - " + plano_nome,
            quantity: 1,
            currency_id: "BRL",
            unit_price: plano_valor
          }
        ],
        payer: {
          email: userData.email,
        },
        back_urls: {
          success: `${webhookUrl}/success`,
          failure: `${webhookUrl}/failure`,
          pending: `${webhookUrl}/pending`
        },
        auto_return: "approved",
        external_reference: {
          app : "fastshii",
          valor: plano_valor,
          userId: userData.uid,
          tipo: 'assinatura',
          plano: plano_nome,
          conta: plano_conta,
        }, 
        payment_methods: paymentMethodsConfig,
        webhook_url: `${webhookUrl}/webhook`
      };
      console.log('preferenceData', preferenceData);
      const preference = await createPreference(preferenceData);
      const result = await WebBrowser.openBrowserAsync(preference.init_point);
      console.log('Resultado do pagamento:', result);
    }
    useEffect(() => {
      const loadPlan = async () => {
        const user = await AsyncStorage.getItem('user');
        if (user) {
          const userData = JSON.parse(user);
          if (userData.conta === 'M') {
            setSelectedPlan('enhanced');
          } else if (userData.conta === 'A') {
            setSelectedPlan('adfree');
          } else if (userData.conta === 'C') {
            setSelectedPlan('combo');
          } else {
            setSelectedPlan('n');
          }
        }
      };
      loadPlan();
    }, []);



  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: themeColors.googleButton }]}>Conta Premium</Text>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Ionicons 
                name="star" 
                size={60} 
                color={themeColors.tint} 
                style={styles.premiumIcon}
              />
              <Text style={[styles.headerTitle, { color: themeColors.googleButton }]}>
                Faça Upgrade para Premium
              </Text>
              <Text style={[styles.headerSubtitle, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}>
                Escolha o plano ideal para você
              </Text>
            </View>

            {/* Plan Cards */}
            <View style={styles.plansContainer}>
              {(Object.values(plans) as Plan[]).map((plan: Plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    { 
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      borderColor: selectedPlan === plan.id ? themeColors.tint : 'transparent',
                      borderWidth: selectedPlan === plan.id ? 2 : 0,
                    }
                  ]}
                  onPress={() => {
                    setSelectedPlan(plan.id as PlanType);
                  }}
                >
                  <View style={styles.planHeader}>
                    <Ionicons 
                      name={plan.icon as any} 
                      size={32} 
                      color={themeColors.tint} 
                    />
                    <Text style={[styles.planTitle, { color: themeColors.googleButton }]}>
                      {plan.title}
                    </Text>
                  </View>

                  <Text style={[styles.planDescription, { 
                    color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' 
                  }]}>
                    {plan.description}
                  </Text>

                  <Text style={[styles.planPrice, { color: themeColors.googleButton }]}>
                    {plan.price}
                  </Text>
                  <Text style={[styles.planPeriod, { 
                    color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' 
                  }]}>
                    por {plan.period}
                  </Text>

                  <View style={styles.featuresList}>
                    {plan.features.map((feature: string, index: number) => (
                      <View key={index} style={styles.featureItem}>
                        <Ionicons 
                          name="checkmark-circle" 
                          size={20} 
                          color={themeColors.tint} 
                        />
                        <Text style={[styles.featureText, { color: themeColors.googleButton }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subscribe Button */}
            {selectedPlan !== 'n' && (
            <TouchableOpacity
              style={[styles.subscribeButton, { backgroundColor: themeColors.tint }]}
              onPress={handleSubscribe}
            >
              <Text style={styles.subscribeButtonText}>
                Assinar {plans[selectedPlan].title}
              </Text>
            </TouchableOpacity>
            )}
            {/* Additional Info */}
            <View style={styles.additionalInfo}>
              <Text style={[styles.infoText, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}>
                • Cancele a qualquer momento
              </Text>
              <Text style={[styles.infoText, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}>
                • Reembolso em até 7 dias
              </Text>
              <Text style={[styles.infoText, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}>
                • Suporte 24/7
              </Text>
            </View>
            

          </View>
        </ScrollView>
      </LinearGradient>

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        onRequestClose={() => setCustomAlert((prev: any) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  appBar: {
    position: 'absolute',
    top: StatusBar.currentHeight,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
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
    marginTop: 90,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  premiumIcon: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  plansContainer: {
    gap: 20,
    marginBottom: 30,
  },
  planCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 10,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  planDescription: {
    fontSize: 14,
    marginBottom: 15,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  planPeriod: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresList: {
    marginTop: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  subscribeButton: {
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 30,
  },
  subscribeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  additionalInfo: {
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
  },
  cancelButton: {
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 30,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default PremiumScreen; 