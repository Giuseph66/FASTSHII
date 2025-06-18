import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { firestore } from '@/firebaseConfig';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import CustomAlert from '@/components/CustomAlert';

interface User {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
  status?: string;
  lastSeen?: number;
}

interface Message {
  id: string;
  image?: string;
  text?: string;
  timestamp: number;
  sender: string;
}

const ContactProfile = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { chatId, participantId } = useLocalSearchParams();
  const router = useRouter();
  const [contact, setContact] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaCount, setMediaCount] = useState(0);
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserName(parsedUser.username);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    };

    const fetchContactData = async () => {
      try {
        const userRef = doc(firestore, 'usuarios', String(participantId));
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setContact(userSnap.data() as User);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do contato:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    fetchContactData();
  }, [participantId]);

  // Efeito separado para contar mídia em tempo real
  useEffect(() => {
    if (!chatId) return;
    const msgsRef = collection(firestore, 'chats', String(chatId), 'messages');
    const unsub = onSnapshot(msgsRef, snap => {
      let count = 0;
      snap.forEach(docSnap => {
        const data = docSnap.data() as Message;
        if (data.image) count += 1;
      });
      setMediaCount(count);
    });
    return () => unsub();
  }, [chatId]);

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'agora mesmo';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutos atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} horas atrás`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.tint }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Informações do contato</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {isLoading && (
            <View style={{ alignItems:'center', padding:20 }}>
              <Ionicons name="hourglass" size={32} color={themeColors.tint} />
              <Text style={{ color: themeColors.textSearch, marginTop:8 }}>Carregando...</Text>
            </View>
          )}

          {/* Foto e Nome */}
          <View style={styles.profileSection}>
            <View style={[styles.avatarContainer, { backgroundColor: themeColors.backgroundfraco }]}>
                <Image source={require('@/assets/icons/aguiaa.png')} style={[styles.avatar, { width: 120, height: 120 , tintColor: themeColors.tint}]} />
            </View>
            <Text style={[styles.name, { color: themeColors.textSearch }]}>{contact?.username}</Text>
            {contact?.status && (
              <Text style={[styles.status, { color: themeColors.textSearch }]}>{contact.status}</Text>
            )}
          </View>

          {/* Informações */}
            {/*
          <View style={[styles.infoSection, { backgroundColor: themeColors.backgroundfraco }]}>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.infoText, { color: themeColors.textSearch }]}>{contact?.email}</Text>
            </View>
            
            {contact?.lastSeen && (
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={24} color={themeColors.tint} />
                <Text style={[styles.infoText, { color: themeColors.textSearch }]}>
                  Visto por último: {formatLastSeen(contact.lastSeen)}
                </Text>
              </View>
            )}
          </View>
                  */}

          {/* Mídia, Links e Docs */}
          <View style={[styles.settingsSection, { backgroundColor: themeColors.backgroundfraco }]}>
            <TouchableOpacity style={styles.settingItem} onPress={() => {
              if (mediaCount > 0) {
                    router.push({
                      pathname: '/SubTelas/MediaGallery',
                      params: { chatId, participantId }
                    });
                  } else {
                setCustomAlert({
                  visible: true,
                  title: 'Mídia',
                  message: 'Nenhuma mídia disponível.',
                  buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
                });
              }
            }}>
              <Ionicons name="images-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.settingText, { color: themeColors.textSearch }]}>Mídia, links e docs</Text>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <Text style={{ color: themeColors.textSearch, marginRight:4 }}>{mediaCount}</Text>
                <Ionicons name="chevron-forward" size={24} color={themeColors.textSearch} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Ações */}
          <View style={[styles.actionsSection, { backgroundColor: themeColors.backgroundfraco }]}>
            <TouchableOpacity style={styles.actionButton} onPress={() => {
              setCustomAlert({
                visible: true,
                title: 'Ligação',
                message: 'Funcionalidade de ligação em desenvolvimento.',
                buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
              });
            }}>
              <Ionicons name="call-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.actionText, { color: themeColors.textSearch }]}>Ligar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => {
              setCustomAlert({
                visible: true,
                title: 'Vídeo',
                message: 'Funcionalidade de vídeo em desenvolvimento.',
                buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
              });
            }}>
              <Ionicons name="videocam-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.actionText, { color: themeColors.textSearch }]}>Vídeo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => {
              router.push({
                pathname: '/SubTelas/SearchMessages',
                params: { chatId }
              });
            }}>
              <Ionicons name="search-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.actionText, { color: themeColors.textSearch }]}>Pesquisar</Text>
            </TouchableOpacity>
          </View>

          {/* Configurações */}
          <View style={[styles.settingsSection, { backgroundColor: themeColors.backgroundfraco }]}>
            <TouchableOpacity style={styles.settingItem} onPress={() => {
              setMuteNotifications(prev => !prev);
              setCustomAlert({
                visible: true,
                title: 'Notificações',
                message: 'Funcionalidade de notificações em desenvolvimento.',
                buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
              });
            }}>
              <Ionicons name={muteNotifications ? 'notifications-off-outline' : 'notifications-outline'} size={24} color={themeColors.tint} />
              <Text style={[styles.settingText, { color: themeColors.textSearch }]}>Notificações {muteNotifications? 'desativadas':'ativadas'}</Text>
              <Ionicons name="chevron-forward" size={24} color={themeColors.textSearch} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => {
              setCustomAlert({
                visible: true,
                title: 'Criptografia',
                message: 'Funcionalidade de criptografia em desenvolvimento.',
                buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
              });
            }}>
              <Ionicons name="lock-closed-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.settingText, { color: themeColors.textSearch }]}>Criptografia</Text>
              <Ionicons name="chevron-forward" size={24} color={themeColors.textSearch} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => {
              setCustomAlert({
                visible: true,
                title: 'Limpar conversa',
                message: 'Funcionalidade de limpar conversa em desenvolvimento.',
                buttons: [{ text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }]
              });
            }}>
              <Ionicons name="trash-outline" size={24} color={themeColors.tint} />
              <Text style={[styles.settingText, { color: themeColors.textSearch }]}>Limpar conversa</Text>
              <Ionicons name="chevron-forward" size={24} color={themeColors.textSearch} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  status: {
    fontSize: 16,
  },
  infoSection: {
    margin: 15,
    borderRadius: 15,
    padding: 15,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoText: {
    marginLeft: 15,
    fontSize: 16,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    margin: 15,
    borderRadius: 15,
    padding: 15,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    marginTop: 5,
    fontSize: 14,
  },
  settingsSection: {
    margin: 15,
    borderRadius: 15,
    padding: 15,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
  },
});

export default ContactProfile; 