import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  useColorScheme,
  SafeAreaView,
  Keyboard,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, query, onSnapshot, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dimensions } from 'react-native';

const { height } = Dimensions.get('window');

interface Message {
  id: string;
  text?: string;
  image?: string;
  timestamp: number;
  sender: string;
  reactions: Record<string, number>;
}

const ChatScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { chatId, nomeConversa } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [participants, setParticipants] = useState<string[]>([]);
  const [headerName, setHeaderName] = useState<string>('Conversa');
  const [inputPadding, setInputPadding] = useState<number | null>(null);
  const [teclado, setTeclado] = useState<number>(0);
  const [envia, setenviar] = useState<boolean>(true);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        console.log('Dados armazenados:', storedUser);
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log('Usuário parseado:', parsedUser);
          
          if (parsedUser.username) {
            setUserName(parsedUser.username);
            console.log('Username definido:', parsedUser.username);
          } else {
            console.log('Username não encontrado nos dados do usuário');
          }
          
          if (parsedUser.uid) {
            setUserUid(parsedUser.uid);
            console.log('UID definido:', parsedUser.uid);
          }
        } else {
          console.log('Nenhum usuário encontrado no AsyncStorage');
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(firestore, 'chats', String(chatId));
    const unsub = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCustomNames(data.customNames || {});
        setParticipants(data.participants || []);
      }
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    if (!userName || !participants.length) return;
    const other = participants.find((p) => p !== userName);
    const displayName = (other && customNames[other]) || other || 'Conversa';
    setHeaderName(displayName);
  }, [userName, participants, customNames]);

  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(firestore, 'chats', String(chatId), 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          image: data.image ? `data:image/jpeg;base64,${data.image}` : null,
        } as Message;
      });
      setMessages(fetchedMessages);
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setInputPadding(height- StatusBar.currentHeight! - 100);
      setTeclado(e.endCoordinates.height + insets.bottom);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setInputPadding(insets.bottom);
      setTeclado(insets.bottom + 80);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = async () => {
    console.log(envia);
    setenviar(false);
    if (!input.trim() && selectedImages.length === 0) {
      setenviar(true);
      return};
    if (!userName) {
      setenviar(true);
      return
    };
    const mensagem = input.trim();
    const imagens = selectedImages;
    const messagesRef = collection(firestore, 'chats', String(chatId), 'messages');
    // Envia texto, se houver
    if (mensagem) {
      const messageData = {
        text: mensagem,
        image: null,
        timestamp: Date.now(),
        sender: userName,
        senderName: userName,
        reactions: {},
      };
      setInput('');
      setSelectedImages([]);
      try {
        await addDoc(messagesRef, messageData);
        const chatDocRef = doc(firestore, 'chats', String(chatId));
        await updateDoc(chatDocRef, {
          lastMessage: mensagem,
          lastMessageTime: Date.now(),
        });
      } catch (error) {
        setInput(mensagem || '');
        setSelectedImages(imagens);
        console.error('Erro ao enviar mensagem:', error);
      }
    }
    // Envia cada imagem como uma mensagem separada
    for (const imgUri of selectedImages) {
      let base64Image = null;
      try {
        const compressedImage = await ImageManipulator.manipulateAsync(
          imgUri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        base64Image = await FileSystem.readAsStringAsync(compressedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (error) {
        console.error('Erro ao processar a imagem:', error);
        continue;
      }
      const messageData = {
        text: '',
        image: base64Image,
        timestamp: Date.now(),
        sender: userName,
        senderName: userName,
        reactions: {},
      };
      try {
        await addDoc(messagesRef, messageData);
        const chatDocRef = doc(firestore, 'chats', String(chatId));
        await updateDoc(chatDocRef, {
          lastMessage: '[imagem]',
          lastMessageTime: Date.now(),
        });
      } catch (error) {
        console.error('Erro ao enviar imagem:', error);
      }
    }
    setenviar(true);
    setInput('');
    setSelectedImages([]);
  };

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const uris = result.assets.map((asset: any) => asset.uri);
      setSelectedImages((prev) => [...prev, ...uris]);
    }
  };

  const removeImage = (uri: string) => {
    setSelectedImages((prev) => prev.filter((img) => img !== uri));
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    if (!chatId) return;
    const messageRef = doc(firestore, 'chats', String(chatId), 'messages', messageId);
    try {
      await updateDoc(messageRef, {
        [`reactions.${reaction}`]: increment(1),
      });
    } catch (error) {
      console.error('Erro ao adicionar reação:', error);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.sender === userName;
    const reactionCounts = item.reactions || {};

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.friendBubble,
        ]}
      >
        {item.image && (
          <TouchableOpacity
            onPress={() => {
              setImageToView(item.image || null);
              setImageViewerVisible(true);
            }}
          >
            <Image
              source={{ uri: item.image }}
              style={styles.messageImage}
            />
          </TouchableOpacity>
        )}
        {item.text && <Text style={styles.messageText}>{item.text}</Text>}
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
        <View style={styles.reactionsContainer}>
          {['👍', '❤️', '😂', '😮', '😢', '👎'].map((reaction) => (
            <TouchableOpacity
              key={reaction}
              onPress={() => handleReaction(item.id, reaction)}
            >
              <Text style={[styles.reaction, { color: themeColors.textSearch }]}>
                {reaction} {reactionCounts[reaction] || 0}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={[themeColors.background, themeColors.background]}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={[styles.chatHeader, { backgroundColor: themeColors.tint }]}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/conversas')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.chatTitle, { color: '#FFFFFF' }]}>{headerName}</Text>
            <TouchableOpacity style={styles.moreButton}>
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Mensagens */}
          <FlatList
            data={messages}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            style={{ flex: 1 , bottom: teclado || insets.bottom + 80, zIndex : 1, marginTop:150}}
            inverted
            keyboardShouldPersistTaps="handled"
          />

          {/* Input fixo */}
          <View style={[styles.inputContainer, {bottom: inputPadding || insets.bottom , backgroundColor: themeColors.backgroundfraco}]}>
            
          {/* Exibidor de imagens selecionadas */}
          {selectedImages.length > 0 && (
            <ScrollView horizontal style={{ maxHeight: 100, maxWidth: '50%', marginBottom: 4 }}>
              {selectedImages.map((uri) => (
                <View key={uri} style={{ marginRight: 8, position: 'relative' }}>
                  <Image source={{ uri }} style={{ width: 70, height: 70, borderRadius: 10 }} />
                  <TouchableOpacity
                    onPress={() => removeImage(uri)}
                    style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 2 }}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
            <TouchableOpacity onPress={handleImagePicker} style={styles.imagePickerButton}>
              <Ionicons name="image-outline" size={24} color={themeColors.tint} />
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={setInput}
              style={[
                styles.input,
                { borderColor: themeColors.tint, backgroundColor: themeColors.icon },
              ]}
              placeholder="Digite uma mensagem..."
              placeholderTextColor={themeColors.text}
            />
            <TouchableOpacity onPress={handleSend} disabled={!envia} style={[styles.sendButton, { backgroundColor: envia? themeColors.tint : 'rgba(41, 41, 41, 0.77)' }]}>
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </View>


          {/* Image Viewer Modal */}
          <Modal visible={imageViewerVisible} transparent={true} animationType="fade">
            <TouchableOpacity
              style={styles.imageViewerContainer}
              activeOpacity={1}
              onPress={() => setImageViewerVisible(false)}
            >
              {imageToView && (
                <Image source={{ uri: imageToView }} style={styles.fullscreenImage} />
              )}
              <TouchableOpacity
                style={styles.closeImageViewerButton}
                onPress={() => setImageViewerVisible(false)}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 20,
    marginTop: 60,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9,
  },
  backButton: {
    padding: 8,
  },
  chatTitle: {
    elevation: 10,
    fontSize: 18,
    fontWeight: 'bold',
  },
  moreButton: {
    padding: 8,
  },
  messageList: {
    flexGrow: 1,
    padding: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6200EE',
  },
  friendBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1E3F',
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  reaction: {
    fontSize: 16,
    marginHorizontal: 4,
  },
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    padding: 10,
    borderRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    zIndex: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  sendButton: {
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerButton: {
    marginRight: 10,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageViewerButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  fullscreenImage: {
    width: '90%',
    height: '70%',
    resizeMode: 'contain',
  },
});
