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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import translations from '@/locales/translations';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebaseConfig';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

// Idioma atual
const currentLanguage = 'pt'; // Altere para 'en' para inglês

interface User {
  id: string;
  email: string;
  password: string;
  user: string;
}

export default function LoginScreen() {
  const colorScheme = useColorScheme(); // Detect system theme
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light; // Select theme colors

  const [email, setEmail] = useState(''); // Estado para o e-mail
  const [password, setPassword] = useState(''); // Estado para a senha
  const [loading, setLoading] = useState(false); // Estado para controlar o carregamento
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleEmailChange = (text: string) => setEmail(text); // Atualiza o estado do e-mail
  const handlePasswordChange = (text: string) => setPassword(text); // Atualiza o estado da senha

  const handleLogin = async () => {
    const normalizedEmail = email.toLowerCase(); // Converte o email para minúsculas

    if (!normalizedEmail || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true); // Inicia o carregamento

    try {
      // Consulta a coleção 'usuarios' procurando o email informado
      const usersQuery = query(
        collection(firestore, 'usuarios'),
        where('email', '==', normalizedEmail)
      );
      const querySnapshot = await getDocs(usersQuery);

      if (querySnapshot.empty) {
        Alert.alert('Erro', 'Usuário não encontrado.');
        setLoading(false); // Finaliza o carregamento
        return;
      }

      let foundUser: User | null = null;
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData && typeof userData === 'object' && 'email' in userData && 'password' in userData && 'user' in userData) {
          foundUser = { 
            id: doc.id, 
            email: userData.email as string,
            password: userData.password as string,
            user: userData.user as string
          };
        }
      });

      if (!foundUser) {
        Alert.alert('Erro', 'Usuário não encontrado.');
        setLoading(false); // Finaliza o carregamento
        return;
      }

      if (foundUser.password !== password) {
        Alert.alert('Erro', 'Senha incorreta.');
        setLoading(false); // Finaliza o carregamento
        return;
      }

      // Armazena dados do usuário no AsyncStorage
      await AsyncStorage.setItem(
        'user',
        JSON.stringify({ email: foundUser.email, uid: foundUser.id, username: foundUser.user })
      );
      Alert.alert('Sucesso', `Bem-vindo, ${foundUser.user}!`);
      router.push('/(tabs)/feed');
    } catch (error: any) {
      console.error('Erro no login:', error);
      Alert.alert('Erro', 'Erro ao tentar fazer login.');
    } finally {
      setLoading(false); // Finaliza o carregamento
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]} // Gradiente baseado no tema
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
              placeholder={translations[currentLanguage].login.email_placeholder}
              value={email}
              onChangeText={handleEmailChange} // Atualiza o estado do e-mail
              style={[styles.input, { color: themeColors.text }]}
              keyboardType="email-address"
              placeholderTextColor={themeColors.icon}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
            <TextInput
              placeholder={translations[currentLanguage].login.password_placeholder}
              value={password}
              onChangeText={handlePasswordChange} // Atualiza o estado da senha
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

          {loading ? (
            <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
          ) : (
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: themeColors.tint }]}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>
                {translations[currentLanguage].login.login_button}
              </Text>
            </TouchableOpacity>
          )}

          <Link href="/register" style={styles.registerLink}>
            <Text style={[styles.registerLinkText, { color: themeColors.tint }]}>
              {translations[currentLanguage].login.register_link}
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
});
