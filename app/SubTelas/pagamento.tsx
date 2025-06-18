import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import CustomAlert from '@/components/CustomAlert';

interface PaymentForm {
  cardNumber: string;
  cardName: string;
  expiryDate: string;
  cvv: string;
  installments: number;
}

const PagamentoScreen = () => {
  const params = useLocalSearchParams<{ method?: string; amount?: string; valor?: string }>();
  const initialMethod: 'credit' | 'pix' = params.method === 'pix' ? 'pix' : 'credit';
  const baseAmount = parseFloat((params.amount ?? params.valor ?? '0') as string);

  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(false);
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [] as { text: string; style: 'default' | 'cancel' | 'destructive'; onPress: () => void }[],
  });

  const [form, setForm] = useState<PaymentForm>({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
    installments: 1,
  });

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'credit' | 'pix'>(initialMethod);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const handleCardNumberChange = (text: string) => {
    setForm(prev => ({ ...prev, cardNumber: formatCardNumber(text) }));
  };

  const handleExpiryDateChange = (text: string) => {
    setForm(prev => ({ ...prev, expiryDate: formatExpiryDate(text) }));
  };

  const validateForm = () => {
    if (selectedPaymentMethod === 'credit') {
      if (!form.cardNumber || form.cardNumber.replace(/\s/g, '').length !== 16) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Número do cartão inválido',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return false;
      }

      if (!form.cardName.trim()) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Nome no cartão é obrigatório',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return false;
      }

      if (!form.expiryDate || form.expiryDate.length !== 5) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Data de validade inválida',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return false;
      }

      if (!form.cvv || form.cvv.length !== 3) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'CVV inválido',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return false;
      }
    }

    return true;
  };

  // Calcula o valor total considerando taxa de 5% para cartão de crédito
  const totalAmount = selectedPaymentMethod === 'credit' ? parseFloat((baseAmount * 1.05).toFixed(2)) : baseAmount;

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Aqui você integraria com o gateway de pagamento usando `totalAmount`
      await new Promise(resolve => setTimeout(resolve, 2000));

      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: `Pagamento de R$ ${totalAmount.toFixed(2)} realizado com sucesso!`,
        buttons: [
          { 
            text: 'OK', 
            style: 'default', 
            onPress: () => {
              setCustomAlert(prev => ({ ...prev, visible: false }));
              router.back();
            }
          }
        ]
      });
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao processar pagamento. Tente novamente.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }]}>
      <StatusBar barStyle="light-content" />
      
      {/* AppBar */}
      <View style={[styles.appBar, { backgroundColor: 'transparent' }]}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: themeColors.googleButton }]}>Pagamento</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          {/* Método de Pagamento */}
          <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
            Método de Pagamento
          </Text>
          
          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentMethodButton,
                selectedPaymentMethod === 'credit' && { backgroundColor: themeColors.tint }
              ]}
              onPress={() => setSelectedPaymentMethod('credit')}
            >
              <Ionicons 
                name="card" 
                size={24} 
                color={selectedPaymentMethod === 'credit' ? '#fff' : themeColors.googleButton} 
              />
              <Text style={[
                styles.paymentMethodText,
                { color: selectedPaymentMethod === 'credit' ? '#fff' : themeColors.googleButton }
              ]}>
                Cartão de Crédito
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentMethodButton,
                selectedPaymentMethod === 'pix' && { backgroundColor: themeColors.tint }
              ]}
              onPress={() => setSelectedPaymentMethod('pix')}
            >
              <Ionicons 
                name="qr-code" 
                size={24} 
                color={selectedPaymentMethod === 'pix' ? '#fff' : themeColors.googleButton} 
              />
              <Text style={[
                styles.paymentMethodText,
                { color: selectedPaymentMethod === 'pix' ? '#fff' : themeColors.googleButton }
              ]}>
                PIX
              </Text>
            </TouchableOpacity>
          </View>

          {selectedPaymentMethod === 'credit' && (
            <>
              {/* Número do Cartão */}
              <Text style={[styles.label, { color: themeColors.googleButton }]}>
                Número do Cartão
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }]}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                keyboardType="numeric"
                maxLength={19}
                value={form.cardNumber}
                onChangeText={handleCardNumberChange}
              />

              {/* Nome no Cartão */}
              <Text style={[styles.label, { color: themeColors.googleButton }]}>
                Nome no Cartão
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }]}
                placeholder="Nome como está no cartão"
                placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                value={form.cardName}
                onChangeText={(text) => setForm(prev => ({ ...prev, cardName: text }))}
              />

              {/* Data de Validade e CVV */}
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={[styles.label, { color: themeColors.googleButton }]}>
                    Validade
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                      borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }]}
                    placeholder="MM/AA"
                    placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                    keyboardType="numeric"
                    maxLength={5}
                    value={form.expiryDate}
                    onChangeText={handleExpiryDateChange}
                  />
                </View>

                <View style={styles.column}>
                  <Text style={[styles.label, { color: themeColors.googleButton }]}>
                    CVV
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                      borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }]}
                    placeholder="123"
                    placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
                    keyboardType="numeric"
                    maxLength={3}
                    value={form.cvv}
                    onChangeText={(text) => setForm(prev => ({ ...prev, cvv: text }))}
                  />
                </View>
              </View>

              {/* Parcelas */}
              <Text style={[styles.label, { color: themeColors.googleButton }]}>
                Parcelas
              </Text>
              <View style={styles.installmentsContainer}>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.installmentButton,
                      form.installments === num && { backgroundColor: themeColors.tint }
                    ]}
                    onPress={() => setForm(prev => ({ ...prev, installments: num }))}
                  >
                    <Text style={[
                      styles.installmentText,
                      { color: form.installments === num ? '#fff' : themeColors.googleButton }
                    ]}>
                      {num}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {selectedPaymentMethod === 'pix' && (
            <View style={styles.pixContainer}>
              <Ionicons name="qr-code" size={100} color={themeColors.googleButton} />
              <Text style={[styles.pixText, { color: themeColors.googleButton }]}>
                Escaneie o QR Code para pagar
              </Text>
              <Text style={[styles.pixSubText, { color: themeColors.googleButton }]}>
                O pagamento será processado automaticamente
              </Text>
            </View>
          )}

          {/* Valor */}
          <View style={styles.amountContainer}>
            <Text style={[styles.amountLabel, { color: themeColors.googleButton }]}>Valor:</Text>
            <Text style={[styles.amountValue, { color: themeColors.googleButton, fontWeight: 'bold' }]}>R$ {totalAmount.toFixed(2)}</Text>
            {selectedPaymentMethod === 'credit' && (
              <Text style={[styles.feeInfo, { color: themeColors.googleButton }]}>Inclui taxa de 5% no cartão</Text>
            )}
          </View>

          {/* Botão de Pagamento */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: themeColors.tint }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Processando...</Text>
            ) : (
              <Text style={styles.submitButtonText}>
                {selectedPaymentMethod === 'credit' ? 'Pagar com Cartão' : 'Gerar PIX'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    paddingHorizontal: 16,
    flexWrap: 'wrap',
  },
  appBarLeft: {
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
    marginTop: 90,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  column: {
    flex: 1,
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  paymentMethodButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '500',
  },
  installmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  installmentButton: {
    width: '15%',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  installmentText: {
    fontSize: 16,
    fontWeight: '500',
  },
  amountContainer: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 18,
  },
  amountValue: {
    fontSize: 22,
    marginTop: 4,
  },
  feeInfo: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  pixContainer: {
    alignItems: 'center',
    padding: 20,
    marginVertical: 20,
  },
  pixText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  pixSubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  submitButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PagamentoScreen; 