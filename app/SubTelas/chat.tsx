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
  const { nomeConversa = 'Conversa Anônima' } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageToView, setImageToView] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

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
    const fetchMessages = async () => {
      if (!userName) return;
      
      const chatId = `${nomeConversa}`;
      const messagesRef = collection(firestore, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

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
    };

    fetchMessages();
  }, [nomeConversa, userName]);

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    if (!userName) return;

    let base64Image = null;

    if (selectedImage) {
      try {
        const compressedImage = await ImageManipulator.manipulateAsync(
          selectedImage,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        base64Image = await FileSystem.readAsStringAsync(compressedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (error) {
        console.error('Erro ao processar a imagem:', error);
        return;
      }
    }

    const messageData = {
      text: input.trim(),
      image: base64Image,
      timestamp: Date.now(),
      sender: userUid,
      reactions: {},
    };

    try {
      const chatId = `${nomeConversa}`;
      const messagesRef = collection(firestore, 'chats', chatId, 'messages');
      await addDoc(messagesRef, messageData);
      setInput('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    if (!userName) return;
    
    const chatId = `${nomeConversa}<>${userName}`;
    const messageRef = doc(firestore, 'chats', chatId, 'messages', messageId);
    try {
      await updateDoc(messageRef, {
        [`reactions.${reaction}`]: increment(1),
      });
    } catch (error) {
      console.error('Erro ao adicionar reação:', error);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.sender === userUid;
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
              <Text style={styles.reaction}>
                {reaction} {reactionCounts[reaction] || 0}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={[styles.chatHeader, { backgroundColor: themeColors.tint }]}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/conversas')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.chatTitle, { color: '#FFFFFF' }]}>{nomeConversa}</Text>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
        />
        <View style={[styles.inputContainer, { backgroundColor: themeColors.background }]}>
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
          <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: themeColors.tint }]}>
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
  },
  backButton: {
    padding: 8,
  },
  chatTitle: {
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
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
