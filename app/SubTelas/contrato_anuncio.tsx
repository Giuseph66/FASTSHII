import React, { useState } from 'react';
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
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

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
  adType: string;
  paymentMethod: string;
  terms: boolean;
  images: string[];
  links: string[];
}

const ContratoAnuncioScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [form, setForm] = useState<ContractForm>({
    advertiserName: '',
    advertiserEmail: '',
    advertiserPhone: '',
    advertiserCNPJ: '',
    adTitle: '',
    adDescription: '',
    startDate: new Date(),
    endDate: new Date(),
    budget: '',
    targetAudience: '',
    adType: '',
    paymentMethod: '',
    terms: false,
    images: [],
    links: [],
  });

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      Alert.alert('Erro', 'Não foi possível selecionar a imagem');
    }
  };

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const addLink = () => {
    if (newLink.trim()) {
      setForm(prev => ({
        ...prev,
        links: [...prev.links, newLink.trim()]
      }));
      setNewLink('');
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
        Alert.alert('Erro', 'Usuário não autenticado');
        return;
      }

      const user = JSON.parse(userData);
      const contractData = {
        ...form,
        userId: user.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(firestore, 'advertising_contracts'), contractData);
      Alert.alert('Sucesso', 'Contrato enviado com sucesso!');
      router.back();
    } catch (error) {
      console.error('Erro ao enviar contrato:', error);
      Alert.alert('Erro', 'Não foi possível enviar o contrato');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.advertiserName || !form.advertiserEmail || !form.advertiserPhone || 
        !form.advertiserCNPJ || !form.adTitle || !form.adDescription || 
        !form.budget || !form.targetAudience || !form.adType || 
        !form.paymentMethod || !form.terms) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }
    return true;
  };

  const renderDatePicker = (show: boolean, value: Date, onChange: (date: Date) => void) => {
    if (!show) return null;

    return (
      <DateTimePicker
        value={value}
        mode="date"
        display="default"
        onChange={(event, selectedDate) => {
          if (selectedDate) {
            onChange(selectedDate);
          }
          setShowStartDatePicker(false);
          setShowEndDatePicker(false);
        }}
      />
    );
  };

  const openModal = () => {
    setIsModalVisible(true);
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
      {[
    {
      title: '1. Objetivo e Escopo',
      desc: 'Estes Termos de Uso regulam a utilização do aplicativo e de suas funcionalidades, descrevendo os direitos, deveres e responsabilidades dos usuários e da plataforma, além de definir os serviços oferecidos e suas limitações.'
    },
    {
      title: '2. Aceitação dos Termos',
      desc: 'Ao utilizar o aplicativo, o usuário declara ter lido, compreendido e aceitado integralmente os presentes Termos de Uso. A continuidade do uso após atualizações será considerada como nova aceitação automática.'
    },
    {
      title: '3. Cadastro e Conta',
      desc: 'Para acesso a determinadas funcionalidades, o usuário poderá precisar criar uma conta. É de sua inteira responsabilidade fornecer informações verdadeiras e manter suas credenciais seguras, não compartilhando com terceiros.'
    },
    {
      title: '4. Privacidade e Uso de Dados',
      desc: 'O aplicativo poderá coletar dados do dispositivo e de uso para personalizar a experiência e exibir anúncios mais relevantes. O usuário consente com essa coleta e com o eventual compartilhamento de dados anonimizados com terceiros, conforme Política de Privacidade.'
    },
    {
      title: '5. Uso Aceitável',
      desc: 'O usuário compromete-se a utilizar o aplicativo de forma ética, legal e respeitosa, abstendo-se de publicar conteúdos ofensivos, falsos, discriminatórios ou que violem qualquer direito de terceiros ou da legislação vigente.'
    },
    {
      title: '6. Conteúdo de Terceiros',
      desc: 'O aplicativo pode conter links, anúncios ou conteúdos de terceiros, cuja responsabilidade é exclusivamente dos respectivos autores. A plataforma não se responsabiliza por danos ou prejuízos decorrentes de tais conteúdos.'
    },
    {
      title: '7. Propriedade Intelectual',
      desc: 'Todos os direitos sobre a marca, nome, layout, códigos e demais elementos do aplicativo pertencem à plataforma. O conteúdo gerado pelos usuários poderá ser utilizado para fins internos, respeitando os termos da Política de Privacidade.'
    },
    {
      title: '8. Modificações no Serviço',
      desc: 'A plataforma poderá, a seu critério, alterar, suspender ou descontinuar funcionalidades do aplicativo a qualquer momento, sem necessidade de aviso prévio, desde que não haja prejuízo direto a direitos adquiridos.'
    },
    {
      title: '9. Limitação de Responsabilidade',
      desc: 'A plataforma não se responsabiliza por perdas, danos diretos ou indiretos decorrentes da utilização do aplicativo, falhas técnicas, indisponibilidades temporárias ou mau uso por parte do usuário.'
    },
    {
      title: '10. Foro e Resolução de Conflitos',
      desc: 'Fica eleito o foro da comarca de São Paulo – SP para dirimir quaisquer dúvidas ou conflitos oriundos destes termos, com renúncia expressa a qualquer outro foro, por mais privilegiado que seja.'
    },
    {
      title: '11. Anúncios e Monetização',
      desc: 'Anunciantes devem seguir nossas diretrizes. Os usuários podem visualizar anúncios personalizados com base em dados de uso.'
    },
    {
      title: '12. Dados do Dispositivo e Análise',
      desc: 'Coletamos dados anonimizados do dispositivo para fins de desempenho e publicidade.'
    },
    {
      title: '13. Foro e Resolução de Conflitos',
      desc: 'Fica eleito o foro da comarca de São Paulo/SP para resolver quaisquer conflitos jurídicos.'
    }
        ].map((item, index) => (
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
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: themeColors.googleButton }]}>Contrato de Anúncio</Text>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            {/* Informações do Anunciante */}
            <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
              Informações do Anunciante
            </Text>
            
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

            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="CNPJ"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              keyboardType="numeric"
              value={form.advertiserCNPJ}
              onChangeText={(text) => setForm({ ...form, advertiserCNPJ: text })}
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
              <TouchableOpacity
                style={[styles.dateButton, { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={[styles.dateButtonText, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                }]}>
                  Data de Início: {form.startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateButton, { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={[styles.dateButtonText, { 
                  color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                }]}>
                  Data de Término: {form.endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Orçamento e Público */}
            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Orçamento (R$)"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              keyboardType="numeric"
              value={form.budget}
              onChangeText={(text) => setForm({ ...form, budget: text })}
            />

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

            {/* Tipo de Anúncio e Pagamento */}
            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Tipo de Anúncio (Banner, Vídeo, etc.)"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              value={form.adType}
              onChangeText={(text) => setForm({ ...form, adType: text })}
            />

            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                color: colorScheme === 'dark' ? themeColors.googleButton : '#000',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}
              placeholder="Método de Pagamento"
              placeholderTextColor={colorScheme === 'dark' ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}
              value={form.paymentMethod}
              onChangeText={(text) => setForm({ ...form, paymentMethod: text })}
            />

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
              onPress={() => setForm({ ...form, terms: !form.terms })}
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

        {renderDatePicker(showStartDatePicker, form.startDate, (date) => 
          setForm({ ...form, startDate: date })
        )}
        {renderDatePicker(showEndDatePicker, form.endDate, (date) => 
          setForm({ ...form, endDate: date })
        )}
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
    position: 'absolute',
    top: 35,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  dateButtonText: {
    fontSize: 14,
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
}); 