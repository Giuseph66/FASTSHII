import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { firestore } from '@/firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

interface Message {
  id: string;
  text?: string;
  image?: string;
  timestamp: number;
  sender: string;
}

const SearchMessages = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!chatId) return;
      try {
        const msgsRef = collection(firestore, 'chats', String(chatId), 'messages');
        const q = query(msgsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const fetchedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          image: doc.data().image ? `data:image/jpeg;base64,${doc.data().image}` : null,
        })) as Message[];
        setMessages(fetchedMessages);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [chatId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMessages([]);
      return;
    }

    const filtered = messages.filter(msg => {
      const text = msg.text?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return text.includes(query);
    });

    setFilteredMessages(filtered);
  }, [searchQuery, messages]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: Message }) => (
    <TouchableOpacity 
      style={[styles.messageItem, { backgroundColor: themeColors.backgroundfraco }]}
      onPress={() => {
        router.push({
          pathname: '/SubTelas/chat',
          params: { 
            chatId,
            messageId: item.id,
            scrollToMessage: true
          }
        });
      }}
    >
      {item.image && (
        <Image source={{ uri: item.image }} style={styles.messageImage} />
      )}
      <View style={styles.messageContent}>
        <Text style={[styles.messageText, { color: themeColors.textSearch }]}>
          {item.text}
        </Text>
        <Text style={[styles.timestamp, { color: themeColors.textSearch }]}>
          {formatDate(item.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.tint }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pesquisar mensagens</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={[styles.searchContainer, { backgroundColor: themeColors.backgroundfraco }]}>
        <Ionicons name="search" size={24} color={themeColors.textSearch} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.textSearch }]}
          placeholder="Pesquisar mensagens..."
          placeholderTextColor={themeColors.textSearch}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={24} color={themeColors.textSearch} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass" size={32} color={themeColors.tint} />
          <Text style={{ color: themeColors.textSearch, marginTop: 8 }}>Carregando...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMessages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            searchQuery.length > 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={themeColors.textSearch} />
                <Text style={{ color: themeColors.textSearch, marginTop: 8 }}>
                  Nenhuma mensagem encontrada
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    padding: 10,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 15,
  },
  messageItem: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  messageImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 10,
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
});

export default SearchMessages; 