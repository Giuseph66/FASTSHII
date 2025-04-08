import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  useColorScheme, 
  Modal, 
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const Profile15Screen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [user, setUser] = useState({ username: '', email: '' });
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [blockedUsersModalVisible, setBlockedUsersModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setNewUsername(userData.username);
        }
      } catch (error) {
        console.error('Failed to load user from AsyncStorage:', error);
      }
    };

    fetchUser();
  }, []);

  const handleEditProfile = () => {
    setEditProfileModalVisible(true);
  };

  const handlePrivacySettings = () => {
    setPrivacyModalVisible(true);
  };

  const handleBlockedUsers = () => {
    setBlockedUsersModalVisible(true);
  };

  const handleSaveProfile = async () => {
    try {
      const updatedUser = { ...user, username: newUsername };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setEditProfileModalVisible(false);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
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
        <View style={styles.header}>
          <View style={[styles.profileImageContainer, { backgroundColor: themeColors.tint }]}>
            <Image 
              source={require('@/assets/icons/aguiaa.png')} 
              style={[styles.profileImage, { tintColor: '#fff' }]} 
            />
          </View>
          <View style={styles.headerContent}>
            <Text style={[styles.username, { color: themeColors.googleButton }]}>{user.username || '[Username]'}</Text>
            <Text style={[styles.email, { color: themeColors.icon }]}>{user.email || '[Email_Address]'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: themeColors.background }]}
            onPress={handleEditProfile}
          >
            <Ionicons name="person-outline" size={24} color={themeColors.tint} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: themeColors.googleButton }]}>Editar perfil</Text>
            <Ionicons name="chevron-forward" size={24} color={themeColors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: themeColors.background }]}
            onPress={handlePrivacySettings}
          >
            <Ionicons name="shield-outline" size={24} color={themeColors.tint} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: themeColors.googleButton }]}>Privacidade</Text>
            <Ionicons name="chevron-forward" size={24} color={themeColors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: themeColors.background }]}
            onPress={handleBlockedUsers}
          >
            <Ionicons name="ban-outline" size={24} color={themeColors.tint} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: themeColors.googleButton }]}>Bloqueio de usuários</Text>
            <Ionicons name="chevron-forward" size={24} color={themeColors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: themeColors.background }]}
            onPress={() => router.replace('/login')}
          >
            <Ionicons name="log-out-outline" size={24} color={themeColors.tint} style={styles.optionIcon} />
            <Text style={[styles.logoutButtonText, { color: themeColors.tint }]}>Sair</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal visible={editProfileModalVisible} transparent={true} animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setEditProfileModalVisible(false)}
          >
            <TouchableOpacity
              style={[styles.modalContent, { backgroundColor: themeColors.background }]}
              activeOpacity={1}
            >
              <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>Editar Perfil</Text>
              <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
                <Ionicons name="person-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
                <TextInput
                  style={[styles.modalInput, { color: themeColors.googleButton }]}
                  placeholder="Novo nome de usuário"
                  placeholderTextColor={themeColors.icon}
                  value={newUsername}
                  onChangeText={setNewUsername}
                />
              </View>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.modalButtonText}>Salvar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal visible={privacyModalVisible} transparent={true} animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setPrivacyModalVisible(false)}
          >
            <TouchableOpacity
              style={[styles.modalContent, { backgroundColor: themeColors.background }]}
              activeOpacity={1}
            >
              <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>Configurações de Privacidade</Text>
              <Text style={[styles.modalText, { color: themeColors.googleButton }]}>Configurações de privacidade em breve...</Text>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                onPress={() => setPrivacyModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal visible={blockedUsersModalVisible} transparent={true} animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setBlockedUsersModalVisible(false)}
          >
            <TouchableOpacity
              style={[styles.modalContent, { backgroundColor: themeColors.background }]}
              activeOpacity={1}
            >
              <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>Usuários Bloqueados</Text>
              <Text style={[styles.modalText, { color: themeColors.googleButton }]}>Nenhum usuário bloqueado.</Text>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                onPress={() => setBlockedUsersModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default Profile15Screen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: height * 0.05,
  },
  gradient: {
    flex: 1,
  },
  header: {
    height: 200,
    width: '100%',
    paddingTop: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  headerContent: {
    alignItems: 'center',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  email: {
    fontSize: 14,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 15,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  optionIcon: {
    marginRight: 15,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: 15,
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 20,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
  },
  modalButton: {
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});
