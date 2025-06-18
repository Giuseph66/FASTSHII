import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  ScrollView,
  Modal
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import translations from '@/locales/translations';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebaseConfig';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';
import { termosDeUso } from '@/contextos/termos';
// Idioma atual
const currentLanguage = 'pt'; // Altere para 'en' para inglês

// Função para gerar nome de usuário aleatório
function generateRandomUsername() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&_-';
  let diagrama = '';
  const tamanho = 8;

  for (let i = 0; i < tamanho; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    diagrama += chars[randomIndex];
  }

  return `User_${diagrama}`;
}

// Regex simples para validar formato de e-mail
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });
  const router = useRouter();
  const params = useLocalSearchParams();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  React.useEffect(() => {
    if (params?.email) setEmail(String(params.email));
    if (params?.password) setPassword(String(params.password));
  }, [params]);

  const handleEmailChange = (text: string) => setEmail(text);
  const handlePasswordChange = (text: string) => setPassword(text);
  const handleConfirmPasswordChange = (text: string) => setConfirmPassword(text);

  const handleRegister = async () => {
    setLoading(true);
    const normalizedEmail = email.toLowerCase();
    const usuario = await query(
      collection(firestore, 'usuarios'),
      where('email', '==', normalizedEmail)
    );
    const querySnapshot = await getDocs(usuario);
    if (!querySnapshot.empty) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'E-mail já cadastrado.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setLoading(false);
      return;
    }
    if (!normalizedEmail || !password || !confirmPassword) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Por favor, preencha todos os campos.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setLoading(false);
      return;
    }
    if (!emailRegex.test(normalizedEmail)) {
      setCustomAlert({
        visible: true,
        title: 'E-mail inválido',
        message: 'Por favor, insira um endereço de e-mail válido.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'As senhas não coincidem.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setLoading(false);
      return;
    }
    if (!termsAccepted) {
      setCustomAlert({
        visible: true,
        title: 'Termos de Uso',
        message: 'Você precisa aceitar os Termos de Uso para se cadastrar.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setLoading(false);
      return;
    }
    try {
      const randomUsername = generateRandomUsername();
      const usuario = {
        user: randomUsername,
        email: normalizedEmail,
        password: password,
      };
      const docRef = await addDoc(collection(firestore, 'usuarios'), usuario);
      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: `Usuário cadastrado com sucesso! Nome de usuário: ${randomUsername}`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => {
              setCustomAlert(prev => ({ ...prev, visible: false }));
              router.push({ pathname: '/login', params: { email: normalizedEmail, password: password } });
            }
          }
        ]
      });
    } catch (error: any) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao salvar usuário: ' + error.message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setCustomAlert({
      visible: true,
      title: 'Atenção',
      message: 'Login em desenvolvimento, por favor, utilize o login com e-mail e senha.',
      buttons: [
        { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
      ]
    });
    return;
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const randomUsername = generateRandomUsername();
      console.log('Usuário autenticado com Google:', user);

      await addDoc(collection(firestore, 'usuarios'), {
        user: randomUsername,
        email: user.email,
        googleId: user.uid,
      });

      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: `Usuário autenticado com Google: ${randomUsername}`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      router.push('/login');
    } catch (error: any) {
      console.error('Erro ao autenticar com Google:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao autenticar com Google: ' + error.message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }
  };

  const register = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      handleRegister();
    }, 200);
  }

  const login = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      router.push('/login');
    }, 200);
  }
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/icons/aguiaa.png')} 
              style={[styles.logo, { tintColor: themeColors.tint }]} 
            />
          </View>
          <View style={[styles.formContainer, { backgroundColor: themeColors.background }]}>
            <Text style={[styles.label, { color: themeColors.textSearch }]}>E-mail</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
              <TextInput
                placeholder={translations[currentLanguage].register.email_placeholder}
                value={email}
                onChangeText={handleEmailChange}
                style={[styles.input, { color: themeColors.text }]}
                keyboardType="email-address"
                placeholderTextColor={themeColors.icon}
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>
            <Text style={[styles.label, { color: themeColors.textSearch }]}>Senha</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
              <TextInput
                placeholder={translations[currentLanguage].register.password_placeholder}
                value={password}
                onChangeText={handlePasswordChange}
                style={[styles.input, { color: themeColors.text }]}
                secureTextEntry={!showPassword}
                placeholderTextColor={themeColors.icon}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color={themeColors.tint} 
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.label, { color: themeColors.textSearch }]}>Confirmar senha</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
              <TextInput
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                style={[styles.input, { color: themeColors.text }]}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor={themeColors.icon}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                accessibilityLabel={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color={themeColors.tint} 
                />
              </TouchableOpacity>
            </View>
            {/* Termos de Uso */}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }} onPress={() => {
                setTermsAccepted(!termsAccepted);
                setTermsModalVisible(true);
              }
            }>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: termsAccepted ? themeColors.tint : '#ccc',
                backgroundColor: termsAccepted ? themeColors.tint : 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                {termsAccepted && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={{ flex: 1, color: themeColors.textSearch, fontSize: 14 }}>
                Li e aceito os <Text style={{ color: themeColors.tint, textDecorationLine: 'underline' , fontWeight: 'bold' }} onPress={() => setTermsModalVisible(true)}>Termos de Uso</Text>
              </Text>
            </TouchableOpacity>
            {/* Modal dos Termos de Uso */}
            <Modal
              visible={termsModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setTermsModalVisible(false)}
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' , margin:100}}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%', maxHeight: '85%' }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }} onPress={() => setTermsModalVisible(false)}>
                    <Ionicons name="close" size={24} color={'#000'} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#222', textAlign: 'center' }}>Termos de Uso</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 16, color: '#222', marginBottom: 12 }}>
                      {termosDeUso}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            </Modal>
            {loading ? (
              <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
            ) : (
              <TouchableOpacity
                style={[styles.registerButton, { backgroundColor: themeColors.tint }]}
                onPress={register}
              >
                <Text style={styles.registerButtonText}>
                  {translations[currentLanguage].register.register_button}
                </Text>
              </TouchableOpacity>
            )}
            {/*
            <TouchableOpacity 
              style={[styles.googleButton, { backgroundColor: themeColors.background }]}
              onPress={handleGoogleSignUp}
            >
              <Image source={require('@/assets/icons/google.png')} style={styles.googleIcon} />
              <Text style={[styles.googleButtonText, { color: themeColors.googleButton }]}>
                Cadastrar com Google
              </Text>
            </TouchableOpacity>*/}

            <TouchableOpacity onPress={login} style={styles.loginLink}>
              <Text style={[styles.loginLinkText, { color: themeColors.tint }]}>Já tem conta? Entrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 350,
    height: 350,
    resizeMode: 'contain',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  registerButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: 16,
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
  },
  loadingIndicator: {
    marginTop: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
});
