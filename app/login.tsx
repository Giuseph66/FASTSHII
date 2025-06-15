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
  Keyboard,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import translations from '@/locales/translations';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { firestore } from '@/firebaseConfig';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';
// Idioma atual
const currentLanguage = 'pt'; // Altere para 'en' para inglês

interface User {
  id: string;
  email: string;
  password: string;
  user: string;
  blockedUsers: string[];
}

export default function LoginScreen() {
  const colorScheme = useColorScheme(); // Detect system theme
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light; // Select theme colors

  const [email, setEmail] = useState(''); // Estado para o e-mail
  const [password, setPassword] = useState(''); // Estado para a senha
  const [loading, setLoading] = useState(false); // Estado para controlar o carregamento
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });
  const router = useRouter();
  const params = useLocalSearchParams();

  // Se vier do cadastro, preenche o e-mail
  React.useEffect(() => {
    if (params?.email) setEmail(String(params.email));
    if (params?.password) setPassword(String(params.password));
  }, [params]);

  const handleEmailChange = (text: string) => setEmail(text); // Atualiza o estado do e-mail
  const handlePasswordChange = (text: string) => setPassword(text); // Atualiza o estado da senha

  const handleLogin = async () => {
    const normalizedEmail = email.toLowerCase();

    if (!normalizedEmail || !password) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Por favor, preencha todos os campos.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    setLoading(true);

    try {
      const usersQuery = query(
        collection(firestore, 'usuarios'),
        where('email', '==', normalizedEmail)
      );
      const querySnapshot = await getDocs(usersQuery);

      if (querySnapshot.empty) {
        setCustomAlert({
          visible: true,
          title: 'Usuário não encontrado',
          message: 'Deseja se cadastrar com este e-mail?',
          buttons: [
            { text: 'Cancelar', style: 'cancel', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) },
            { text: 'Cadastrar', style: 'default', onPress: () => {
                setCustomAlert(prev => ({ ...prev, visible: false }));
                router.push({ pathname: '/register', params: { email: normalizedEmail, password: password } });
              }
            }
          ]
        });
        return;
      }

      // Pega o primeiro documento (deve ser único por email)
      const doc = querySnapshot.docs[0];
      const userData = doc.data();
      
      if (userData.password !== password) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Senha incorreta.',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      const user: User = {
        id: doc.id,
        email: userData.email,
        password: userData.password,
        user: userData.user,
        blockedUsers: userData.blockedUsers || []
      };

      // Armazena dados do usuário no AsyncStorage
      await AsyncStorage.setItem(
        'user',
        JSON.stringify({
          email: user.email,
          uid: user.id,
          username: user.user,
          blockedUsers: user.blockedUsers
        })
      );

      setUser(user);
      
      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: `Bem-vindo, ${user.user}!`,
        buttons: [
          { 
            text: 'OK', 
            style: 'default', 
            onPress: () => {
              setCustomAlert(prev => ({ ...prev, visible: false }));
              router.push('/(tabs)/feed');
            }
          }
        ]
      });
    } catch (error: any) {
      console.error('Erro no login:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao tentar fazer login: ' + (error.message || 'Erro desconhecido'),
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    } finally {
      setLoading(false);
    }
  };
  const register = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      router.push({ pathname: '/register', params: { email: email, password: password } });
    }, 200);
  }
  const login = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      handleLogin();
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
                placeholder={translations[currentLanguage].login.email_placeholder}
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
                placeholder={translations[currentLanguage].login.password_placeholder}
                value={password}
                onChangeText={handlePasswordChange}
                style={[styles.input, { color: themeColors.text }]}
                secureTextEntry={!showPassword}
                placeholderTextColor={themeColors.icon}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
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
            {loading ? (
              <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
            ) : (
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: themeColors.tint }]}
                onPress={login}
              >
                <Text style={styles.loginButtonText}>
                  {translations[currentLanguage].login.login_button}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={register} style={styles.registerLink}>
              <Text style={[styles.registerLinkText, { color: themeColors.tint }]}>Ainda não tem conta? Cadastre-se</Text>
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
  loginButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
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
