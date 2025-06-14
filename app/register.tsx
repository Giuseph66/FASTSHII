import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  Alert, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  useColorScheme,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import translations from '@/locales/translations';
import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '@/firebaseConfig';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

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

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const handleEmailChange = (text: string) => setEmail(text);
  const handlePasswordChange = (text: string) => setPassword(text);
  const handleConfirmPasswordChange = (text: string) => setConfirmPassword(text);

  const handleRegister = async () => {
    const normalizedEmail = email.toLowerCase();

    if (!normalizedEmail || !password || !confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      console.log('Iniciando cadastro...');
      const randomUsername = generateRandomUsername();

      const usuario = {
        user: randomUsername,
        email: normalizedEmail,
        password: password,
      };

      const docRef = await addDoc(collection(firestore, 'usuarios'), usuario);
      Alert.alert('Sucesso', `Usuário cadastrado com sucesso! Nome de usuário: ${randomUsername}`);
      console.log('Usuário salvo com ID:', docRef.id);
      router.push('/login');
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      Alert.alert('Erro', 'Erro ao salvar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    Alert.alert('Atenção', 'Login em desenvolvimento, por favor, utilize o login com e-mail e senha.');
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

      Alert.alert('Sucesso', `Usuário autenticado com Google: ${randomUsername}`);
      router.push('/login');
    } catch (error: any) {
      console.error('Erro ao autenticar com Google:', error);
      Alert.alert('Erro', 'Erro ao autenticar com Google: ' + error.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/icons/aguiaa.png')} 
            style={[styles.logo, { tintColor: themeColors.tint }]} 
          />
        </View>

        <View style={[styles.formContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
            <TextInput
              placeholder={translations[currentLanguage].register.email_placeholder}
              value={email}
              onChangeText={handleEmailChange}
              style={[styles.input, { color: themeColors.text }]}
              keyboardType="email-address"
              placeholderTextColor={themeColors.icon}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
            <TextInput
              placeholder={translations[currentLanguage].register.password_placeholder}
              value={password}
              onChangeText={handlePasswordChange}
              style={[styles.input, { color: themeColors.text }]}
              secureTextEntry={!showPassword}
              placeholderTextColor={themeColors.icon}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color={themeColors.tint} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
            <TextInput
              placeholder="Confirmar senha"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              style={[styles.input, { color: themeColors.text }]}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor={themeColors.icon}
            />
            <TouchableOpacity 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color={themeColors.tint} 
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
          ) : (
            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: themeColors.tint }]}
              onPress={handleRegister}
            >
              <Text style={styles.registerButtonText}>
                {translations[currentLanguage].register.register_button}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.googleButton, { backgroundColor: themeColors.background }]}
            onPress={handleGoogleSignUp}
          >
            <Image source={require('@/assets/icons/google.png')} style={styles.googleIcon} />
            <Text style={[styles.googleButtonText, { color: themeColors.googleButton }]}>
              Cadastrar com Google
            </Text>
          </TouchableOpacity>

          <Link href="/login" style={styles.loginLink}>
            <Text style={[styles.loginLinkText, { color: themeColors.tint }]}>
              {translations[currentLanguage].register.login_link}
            </Text>
          </Link>
        </View>
      </LinearGradient>
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
});
