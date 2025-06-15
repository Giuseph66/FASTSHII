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
import { getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { firestore } from '@/firebaseConfig';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';
import * as LocalAuthentication from 'expo-local-authentication';

const { width, height } = Dimensions.get('window');



interface BlockedUser {
  id: string;
  username: string;
}

interface User {
  username: string;
  email: string;
  uid: string;
  blockedUsers: BlockedUser[];
}

const Profile15Screen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [user, setUser] = useState<User>({ username: '', email: '', uid: '', blockedUsers: [] });
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [blockedUsersModalVisible, setBlockedUsersModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [customAlert, setCustomAlert] = useState<{ visible: boolean; title: string; message: string; buttons: CustomAlertButton[] }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });
  const [ocultarSenhaatual, setOcultarSenhaatual] = useState(true);
  const [ocultarSenhanova, setOcultarSenhanova] = useState(true);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          console.log(userData)
          setUser(userData);
          setNewEmail(userData.email);
        }
      } catch (error) {
        console.error('Failed to load user from AsyncStorage:', error);
      }
    };

    fetchUser();
  }, []);

  const handleEditProfile = async () => {
    if (Platform.OS === 'web') {
      setEditProfileModalVisible(true);
      return;
    }
    // Solicitar autenticação biométrica
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      setCustomAlert({
        visible: true,
        title: 'Biometria não disponível',
        message: 'Seu dispositivo não suporta biometria ou não há biometria cadastrada.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirme sua identidade para editar o perfil',
      fallbackLabel: 'Usar senha',
      cancelLabel: 'Cancelar',
    });
    if (result.success) {
      setEditProfileModalVisible(true);
    } else {
      setCustomAlert({
        visible: true,
        title: 'Falha na autenticação',
        message: 'Não foi possível autenticar sua identidade.',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
    }
  };

  const handlePrivacySettings = () => {
    setPrivacyModalVisible(true);
  };

  const handleBlockedUsers = async () => {
    try {
      setBlockedUsersModalVisible(true);
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Usuário não autenticado',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        setBlockedUsersModalVisible(false);
        return;
      }

      const currentUser = JSON.parse(userStr);
      const userDoc = await getDoc(doc(firestore, 'usuarios', currentUser.uid));
      
      if (!userDoc.exists()) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Usuário não encontrado',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        setBlockedUsersModalVisible(false);
        return;
      }

      const userData = userDoc.data();
      const blockedUsersIds: BlockedUser[] = userData.blockedUsers || [];

      // Buscar informações dos usuários bloqueados
      const blockedUsersInfo: BlockedUser[] = [];
      for (const blockedId of blockedUsersIds) {
          blockedUsersInfo.push({
            id: blockedId.id,
            username: blockedId.username || 'Usuário Desconhecido'
          });
        }

      // Atualizar o estado local com os usuários bloqueados
      setUser(prev => ({ ...prev, blockedUsers: blockedUsersInfo }));
      
      // Atualizar o AsyncStorage com os dados mais recentes
      const updatedUserData = {
        ...currentUser,
        blockedUsers: blockedUsersIds
      };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUserData));

      // Mostrar o modal

    } catch (error: any) {
      console.error('Erro ao carregar usuários bloqueados:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao carregar usuários bloqueados: ' + error.message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setBlockedUsersModalVisible(false);
    }
  };

  const handleUnblockUser = (userId: string, username: string) => {
    setCustomAlert({
      visible: true,
      title: `Desbloqueando usuário ${username}`,
      message: `Tem certeza que deseja desbloquear o usuário?`,
      buttons: [
        { text: 'Cancelar', style: 'cancel', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) },
        { text: 'OK', style: 'default', onPress: async () => {
          try {
            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) return;
            const currentUser = JSON.parse(userStr);
            // Atualizar no Firestore
            const userRef = doc(firestore, 'usuarios', currentUser.uid);
            await updateDoc(userRef, {
              blockedUsers: arrayRemove({id: userId, username: username})
            });
            // Atualizar no AsyncStorage
            const updatedBlockedUsers = (currentUser.blockedUsers || []).filter((id: string) => id !== userId);
            const updatedUserData = {
              ...currentUser,
              blockedUsers: updatedBlockedUsers
            };
            await AsyncStorage.setItem('user', JSON.stringify(updatedUserData));
            // Atualizar o estado local
            setUser(prev => ({
              ...prev,
              blockedUsers: prev.blockedUsers.filter((user: BlockedUser) => user.id !== userId)
            }));
            setCustomAlert({
              visible: true,
              title: 'Sucesso',
              message: `Usuário ${username} foi desbloqueado com sucesso.`,
              buttons: [
                { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
              ]
            });
          } catch (error: any) {
            setCustomAlert({
              visible: true,
              title: 'Erro',
              message: 'Erro ao desbloquear usuário: ' + error.message,
              buttons: [
                { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
              ]
            });
          }
        } }
      ]
    });
  };

  const handleSaveProfile = async () => {
    setSalvando(true)
    try {
      const consulta = await getDoc(doc(firestore, 'usuarios', user.uid));
      const userData = consulta.data();
      if (userData?.password !== currentPassword) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'A senha atual está incorreta',
          buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
        });
        setSalvando(false)
        return;
      }
      if (newPassword === '') {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'A senha não pode ser vazia',
          buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
        });
        setSalvando(false)
        return;
      }
      if (newPassword === currentPassword) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'A nova senha não pode ser igual à senha atual',
          buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
        });
        setSalvando(false)
        return;
      }
      await updateDoc(doc(firestore, 'usuarios', user.uid), {
        email: newEmail,
        password: newPassword
      });
      const updatedUser = { ...user, email: newEmail, password: newPassword };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: 'Perfil salvo com sucesso',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
      setCurrentPassword('');
      setNewPassword('');
      setEditProfileModalVisible(false);
      setSalvando(false)
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao salvar perfil, tente novamente mais tarde',
        buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
      });
      setSalvando(false)
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

        <ScrollView contentContainerStyle={[styles.optionsContainer, {paddingBottom: 100}]}>
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
            style={[styles.optionCard, { backgroundColor: themeColors.background }]}
            onPress={() => router.push({
              pathname: '/SubTelas/contrato_anuncio',
              params: { userid: user.uid }
            })}
          >
            <Ionicons name="person-outline" size={24} color={themeColors.tint} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: themeColors.googleButton }]}>Contrato de anúncio</Text>
            <Ionicons name="chevron-forward" size={24} color={themeColors.icon} />
          </TouchableOpacity>
        
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: themeColors.background }]}
            onPress={() => router.push({
              pathname: '/SubTelas/perfil_outros',
              params: { userid: user.uid }
            })}
          >
            <Ionicons name="person-outline" size={24} color={themeColors.tint} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: themeColors.googleButton }]}>Perfil de geral</Text>
            <Ionicons name="chevron-forward" size={24} color={themeColors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: themeColors.background }]}
            onPress={() => {
              setCustomAlert({
                visible: true,
                title: 'Sair da conta',
                message: 'Tem certeza que deseja sair?',
                buttons: [
                  { text: 'Cancelar', style: 'cancel', onPress: () => setCustomAlert({ ...customAlert, visible: false }) },
                  { text: 'Sair', style: 'destructive', onPress: () => {
                    AsyncStorage.removeItem('user');
                    router.replace('/login');
                  } },
                ]
              });
            }}
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
             
              <Text style={[styles.modalText, { color: themeColors.googleButton }]}>Email</Text>
              <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
                <Ionicons name="mail-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
                <TextInput
                  style={[styles.modalInput, { color: themeColors.googleButton }]}
                  placeholder="Novo Email"
                  placeholderTextColor={themeColors.icon}
                  value={newEmail}
                  onChangeText={setNewEmail}
                />
              </View>

              <Text style={[styles.modalText, { color: themeColors.googleButton }]}>Senha atual</Text>
              <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
                <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
                <TextInput
                  style={[styles.modalInput, { color: themeColors.googleButton }]}
                  placeholder="Senha atual"
                  placeholderTextColor={themeColors.icon}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={ocultarSenhaatual}
                />
                <TouchableOpacity onPress={() => setOcultarSenhaatual(!ocultarSenhaatual)}>
                <Ionicons name={ocultarSenhaatual ? "eye-off-outline" : "eye-outline"} size={24} color={themeColors.tint} style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>Nova Senha</Text>
              <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
                <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} style={styles.inputIcon} />
                <TextInput
                  style={[styles.modalInput, { color: themeColors.googleButton }]}
                  placeholder="Nova senha"
                  placeholderTextColor={themeColors.icon}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={ocultarSenhanova}
                />
                <TouchableOpacity onPress={() => setOcultarSenhanova(!ocultarSenhanova)}>
                <Ionicons name={ocultarSenhanova ? "eye-off-outline" : "eye-outline"} size={24} color={themeColors.tint} style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                onPress={handleSaveProfile}
                disabled={salvando}
              >
                <Text style={styles.modalButtonText}>{salvando ? 'Salvando...' : 'Salvar'}</Text>
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
               <View style={{ marginBottom: 16, backgroundColor: 'rgba(0,200,83,0.08)', borderRadius: 10, padding: 12 }}>
                <Ionicons name="shield-checkmark" size={28} color={themeColors.tint} style={{ alignSelf: 'center', marginBottom: 4 }} />
                <Text style={{ color: themeColors.tint, fontWeight: 'bold', fontSize: 16, textAlign: 'center', marginBottom: 4 }}>
                  Segurança de ponta a ponta
                </Text>
                <Text style={{ color: themeColors.textSearch, fontSize: 14, textAlign: 'center' }}>
                  Este aplicativo utiliza criptografia avançada para proteger seus dados. Todas as informações são armazenadas e transmitidas de forma segura, garantindo privacidade total. Sua conta está protegida com autenticação biométrica e senha. Confie: sua segurança é nossa prioridade!
                </Text>
              </View>
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
              
              <ScrollView style={styles.blockedUsersScrollView}>
                {Array.isArray(user.blockedUsers) && user.blockedUsers.length > 0 ? (
                  user.blockedUsers.map((blockedUser: any, idx: number) => {
                    const key = typeof blockedUser === 'object' && blockedUser.id
                      ? blockedUser.id
                      : typeof blockedUser === 'string'
                        ? blockedUser
                        : idx;
                    const username = typeof blockedUser === 'object' && blockedUser.username
                      ? blockedUser.username
                      : '';
                    return (
                      <View key={key} style={[styles.blockedUserItem, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                        <View style={styles.blockedUserInfo}>
                          <Ionicons name="person-circle-outline" size={24} color={themeColors.tint} style={styles.blockedUserIcon} />
                          <Text style={[styles.blockedUserName, { color: themeColors.textSearch }]}>
                            {username}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.unblockButton, { backgroundColor: themeColors.tint }]}
                          onPress={() => handleUnblockUser(key, username)}
                        >
                          <Ionicons name="lock-open-outline" size={20} color="#fff" />
                          <Text style={styles.unblockButtonText}>Desbloquear</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyBlockedUsers}>
                    <Ionicons name="people-outline" size={48} color={themeColors.icon} />
                    <Text style={[styles.emptyBlockedUsersText, { color: themeColors.googleButton }]}>
                      Nenhum usuário bloqueado
                    </Text>
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                onPress={() => setBlockedUsersModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          buttons={customAlert.buttons}
          onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}
        />
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
    paddingTop: 20
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
    width: '95%',
    borderRadius: 20,
    padding: 20,
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
    textAlign: 'center',
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
    textAlign: 'left',
    marginLeft: 10,
    marginBottom: 10,
  },
  blockedUsersScrollView: {
    width: '100%',
    maxHeight: 300,
    marginBottom: 20,
  },
  blockedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  blockedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  blockedUserIcon: {
    marginRight: 12,
  },
  blockedUserName: {
    fontSize: 16,
    flex: 1,
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  unblockButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
  },
  emptyBlockedUsers: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyBlockedUsersText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});
