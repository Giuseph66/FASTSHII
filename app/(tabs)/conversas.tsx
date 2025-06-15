import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useColorScheme,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { firestore } from '@/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Chat {
  id: string;
  lastMessage: string;
  lastMessageTime: number;
  participants: string[];
  customNames: Record<string, string>;
}

const List11MessagesScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme(); // Detect system theme
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light; // Select theme colors

  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserUid(parsedUser.uid);
          setNome(parsedUser.username);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (!nome) return;

    const chatsRef = collection(firestore, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', nome)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Chat data:', {
          id: doc.id,
          participants: data.participants,
          customNames: data.customNames,
          lastMessage: data.lastMessage
        });
        return {
          id: doc.id,
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTime || 0,
          participants: data.participants || [],
          customNames: data.customNames || {}
        };
      });
      
      chatList.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [nome]);

  const handleConversationPress = (chatId: string, customNames: Record<string, string>) => {
    const otherParticipant = Object.entries(customNames)
      .find(([participantName]) => participantName !== nome)?.[0] || 'Usuário';
    
    router.push({
      pathname: '/SubTelas/chat',
      params: { 
        chatId: chatId,
        nomeConversa: otherParticipant,
      },
    });
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ontem';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  };

  // Função para filtrar conversas
  const filteredChats = searchActive && searchText.trim().length > 0
    ? chats.filter(chat => {
        const otherParticipant = chat.participants.find((p: string) => p !== nome);
        const displayName = (otherParticipant && chat.customNames[otherParticipant]) || otherParticipant || '';
        return (
          displayName.toLowerCase().includes(searchText.toLowerCase()) ||
          (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchText.toLowerCase()))
        );
      })
    : chats;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: themeColors.tint }]}>
          {searchActive ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: themeColors.background,
                  color: themeColors.textSearch,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  height: 36,
                  marginRight: 8,
                }}
                placeholder="Pesquisar..."
                placeholderTextColor={themeColors.textSearch}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setSearchActive(false); setSearchText(''); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
          <Text style={[styles.appBarTitle, { color: '#fff' }]}>Mensagens</Text>
              <TouchableOpacity style={styles.searchButton} onPress={() => setSearchActive(true)}>
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {filteredChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: themeColors.textSearch}]}>
                Nenhuma conversa ainda
              </Text>
            </View>
          ) : (
            filteredChats.map((chat, index) => {
              const otherParticipant = chat.participants.find((p: string) => p !== nome);
              const displayName = (otherParticipant && chat.customNames[otherParticipant]) || otherParticipant || 'Usuário';

              return (
                <View key={chat.id}>
              <TouchableOpacity
                    onPress={() => handleConversationPress(chat.id, chat.customNames)}
                style={[styles.messageCard, { backgroundColor: themeColors.background }]}
              >
                <View style={[styles.avatarContainer, { backgroundColor: themeColors.tint }]}>
                  <Image 
                        source={require('@/assets/icons/aguiaa.png')} 
                    style={[styles.avatar, { tintColor: '#fff' }]} 
                  />
                </View>
                <View style={styles.messageContent}>
                      <Text style={[styles.remetente, { color: themeColors.googleButton }]}>
                        {displayName}
                      </Text>
                      <Text style={[styles.trecho, { color: themeColors.icon }]} numberOfLines={1}>
                        {chat.lastMessage}
                      </Text>
                  <View style={styles.messageFooter}>
                        <Text style={[styles.horario, { color: themeColors.icon }]}>
                          {formatTimestamp(chat.lastMessageTime)}
                        </Text>
                  </View>
                </View>
              </TouchableOpacity>
                  {index < filteredChats.length - 1 && (
                <View style={[styles.divider, { backgroundColor: themeColors.icon }]} />
              )}
            </View>
              );
            })
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default List11MessagesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBar: {
    height: 60,
    width: '96%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    paddingHorizontal: 20,
    marginTop: 45,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchButton: {
    padding: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  messageContent: {
    flex: 1,
  },
  remetente: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trecho: {
    fontSize: 14,
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  horario: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
