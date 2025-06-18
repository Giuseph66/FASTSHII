import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Platform,
  StatusBar,
  Switch,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';
import { firestore } from '@/firebaseConfig';
import { collection, doc, updateDoc, getDoc } from 'firebase/firestore';

interface ConfigSettings {
  maintenanceMode: boolean;
  maxAnnouncementDuration: number;
  minBudget: number;
  maxBudget: number;
  defaultReach: number;
  maxImagesPerAnnouncement: number;
  maxLinksPerAnnouncement: number;
  adminEmail: string;
  supportPhone: string;
  termsVersion: string;
}

const ConfiguracoesAdminScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState<ConfigSettings>({
    maintenanceMode: false,
    maxAnnouncementDuration: 90,
    minBudget: 10,
    maxBudget: 10000,
    defaultReach: 1000,
    maxImagesPerAnnouncement: 5,
    maxLinksPerAnnouncement: 3,
    adminEmail: '',
    supportPhone: '',
    termsVersion: '1.0',
  });

  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });

  useEffect(() => {
    checkAdminStatus();
    loadSettings();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        const userDoc = await getDoc(doc(firestore, 'usuarios', user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
          setIsAdmin(true);
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Erro ao verificar status de admin:', error);
      router.replace('/login');
    }
  };

  const loadSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(firestore, 'configuracoes', 'geral'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as ConfigSettings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível carregar as configurações.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsData = {
        maintenanceMode: settings.maintenanceMode,
        maxAnnouncementDuration: settings.maxAnnouncementDuration,
        minBudget: settings.minBudget,
        maxBudget: settings.maxBudget,
        defaultReach: settings.defaultReach,
        maxImagesPerAnnouncement: settings.maxImagesPerAnnouncement,
        maxLinksPerAnnouncement: settings.maxLinksPerAnnouncement,
        adminEmail: settings.adminEmail,
        supportPhone: settings.supportPhone,
        termsVersion: settings.termsVersion,
      };
      await updateDoc(doc(firestore, 'configuracoes', 'geral'), settingsData);
      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: 'Configurações salvas com sucesso!',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível salvar as configurações.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: 'transparent' }]}>
          <View style={styles.appBarLeft}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.appBarTitle, { color: themeColors.googleButton }]}>
              Configurações do Sistema
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            {/* Modo de Manutenção */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.googleButton , marginTop: 20}]}>
                Modo de Manutenção
              </Text>
              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: themeColors.googleButton }]}>
                  Ativar modo de manutenção
                </Text>
                <Switch
                  value={settings.maintenanceMode}
                  onValueChange={(value) => setSettings({ ...settings, maintenanceMode: value })}
                  trackColor={{ false: '#767577', true: themeColors.tint }}
                  thumbColor={settings.maintenanceMode ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Configurações de Anúncios */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                Configurações de Anúncios
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  Duração Máxima (dias)
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.maxAnnouncementDuration.toString()}
                  onChangeText={(value) => setSettings({ ...settings, maxAnnouncementDuration: parseInt(value) || 0 })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  Alcance Padrão
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.defaultReach.toString()}
                  onChangeText={(value) => setSettings({ ...settings, defaultReach: parseInt(value) || 0 })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Limites do Sistema */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                Limites do Sistema
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  Máximo de Imagens por Anúncio
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.maxImagesPerAnnouncement.toString()}
                  onChangeText={(value) => setSettings({ ...settings, maxImagesPerAnnouncement: parseInt(value) || 0 })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  Máximo de Links por Anúncio
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.maxLinksPerAnnouncement.toString()}
                  onChangeText={(value) => setSettings({ ...settings, maxLinksPerAnnouncement: parseInt(value) || 0 })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Informações de Contato */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                Informações de Contato
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  E-mail do Administrador
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.adminEmail}
                  onChangeText={(value) => setSettings({ ...settings, adminEmail: value })}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  Telefone de Suporte
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.supportPhone}
                  onChangeText={(value) => setSettings({ ...settings, supportPhone: value })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.googleButton }]}>
                  Versão dos Termos
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: themeColors.textSearch,
                    borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }]}
                  value={settings.termsVersion}
                  onChangeText={(value) => setSettings({ ...settings, termsVersion: value })}
                />
              </View>
            </View>

            {/* Botão de Salvar */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: themeColors.tint }]}
              onPress={saveSettings}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Salvar Configurações</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
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
});

export default ConfiguracoesAdminScreen; 