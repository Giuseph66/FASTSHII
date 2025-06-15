import React, { useState, useEffect, useRef } from 'react';
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
import ImageViewer from 'react-native-image-zoom-viewer';
import CustomAlert from '@/components/CustomAlert';
import type { CustomAlertButton } from '@/components/CustomAlert';

const { height } = Dimensions.get('window');

interface Message {
  id: string;
  text?: string;
  image?: string;
  timestamp: number;
  sender: string;
  reactions: Record<string, string[]>;
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
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [savingCustomName, setSavingCustomName] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const previewScrollRef = useRef<ScrollView>(null);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [reactionTargetMessageId, setReactionTargetMessageId] = useState<string>('');
  const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '👎'];
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });

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

  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTo({
        x: Math.max(0, (imageViewerIndex - 1) * 44), // 36px img + 8px margin
        animated: true,
      });
    }
  }, [imageViewerIndex]);

  const handleSend = async () => {
    setenviar(false);
    if (!input.trim() && selectedImages.length === 0) {
      setenviar(true);
      return;
    }
    if (!userName) {
      setenviar(true);
      return;
    }
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
      } catch (error: any) {
        setInput(mensagem || '');
        setSelectedImages(imagens);
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Erro ao enviar mensagem: ' + (error?.message || error),
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        console.error('Erro ao enviar mensagem:', error);
      }
    }
    // Envia cada imagem como uma mensagem separada
    for (const imgUri of selectedImages) {
      let base64Image = null;
      try {
        if (Platform.OS === 'web') {
          // Buscar base64 do asset selecionado
          // O ImagePicker no web retorna assets com base64 se base64: true
          // Mas seu picker não está usando base64: true, então precisamos buscar o asset correto
          // Sugestão: usar um estado para armazenar os assets, mas aqui vamos tentar buscar via fetch
          const compressedImage = await ImageManipulator.manipulateAsync(
            imgUri,
            [{ resize: { width: 800 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          const response = await fetch(compressedImage.uri);
          const blob = await response.blob();
          base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          const compressedImage = await ImageManipulator.manipulateAsync(
            imgUri,
            [{ resize: { width: 800 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          base64Image = await FileSystem.readAsStringAsync(compressedImage.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      } catch (error: any) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Erro ao processar a imagem: ' + (error?.message || error),
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
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
      } catch (error: any) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Erro ao enviar imagem: ' + (error?.message || error),
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
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

  const handleChangeCustomName = async () => {
    if (!chatId || !userName || !newCustomName.trim() || participants.length < 2) return;
    const otherParticipant = participants.find((p) => p !== userName);
    if (!otherParticipant) return;
    setSavingCustomName(true);
    try {
      const chatRef = doc(firestore, 'chats', String(chatId));
      await updateDoc(chatRef, {
        [`customNames.${otherParticipant}`]: newCustomName.trim(),
      });
      setEditNameModalVisible(false);
      setNewCustomName('');
    } catch (error) {
      console.error('Erro ao atualizar nome da conversa:', error);
    } finally {
      setSavingCustomName(false);
    }
  };

  // Função para obter layout do grid WhatsApp-like
  function getGridLayout(count: number) {
    if (count === 1) return { rows: 1, cols: 1 };
    if (count === 2) return { rows: 1, cols: 2 };
    if (count === 3) return { rows: 1, cols: 3 };
    if (count === 4) return { rows: 2, cols: 2 };
    if (count <= 6) return { rows: 2, cols: 3 };
    return { rows: 3, cols: 3 };
  }

  // Função para agrupar imagens consecutivas do mesmo usuário
  function groupImageMessages(messages: Message[]) {
    const groups: (Message[])[] = [];
    let currentGroup: Message[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = messages[i - 1];
      const isImage = !!msg.image && !msg.text;
      const prevIsImage = prev && !!prev.image && !prev.text;
      const sameUser = prev && prev.sender === msg.sender;
      const closeInTime = prev && Math.abs(msg.timestamp - prev.timestamp) < 60000; // 60s
      if (
        isImage &&
        prev &&
        prevIsImage &&
        sameUser &&
        closeInTime
      ) {
        currentGroup.push(msg);
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = isImage ? [msg] : [];
        if (!isImage) groups.push([msg]);
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups;
  }

  // Novo array agrupado para renderização
  const groupedMessages = groupImageMessages(messages);

  // Imagens para o ImageViewer (ordem correta)
  const imageMessages = messages.filter(m => m.image).slice().reverse();
  const imageUrls = imageMessages.map(m => ({ url: m.image! }));

  const handleImagePress = (clickedImage: string) => {
    const index = imageMessages.findIndex(m => m.image === clickedImage);
    setImageViewerIndex(index);
    setImageViewerVisible(true);
  };

  // Função para adicionar/remover reação
  const handleSelectReaction = async (messageId: string, reaction: string) => {
    if (!chatId || !userName) return;
    const messageRef = doc(firestore, 'chats', String(chatId), 'messages', messageId);
    // Buscar mensagem atual
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const reactions = msg.reactions || {};
    const users = Array.isArray(reactions[reaction]) ? reactions[reaction] : [];
    let newReactions = { ...reactions };
    if (users.includes(userName)) {
      // Remover reação
      newReactions[reaction] = users.filter(u => u !== userName);
    } else {
      // Adicionar reação (garantir que só pode 1 por usuário por emoji)
      newReactions[reaction] = [...users, userName];
    }
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: newReactions[reaction],
    });
    setReactionModalVisible(false);
    setReactionTargetMessageId('');
  };

  // Função para abrir modal de reação
  const openReactionModal = (messageId: string) => {
    setReactionTargetMessageId(messageId);
    setReactionModalVisible(true);
  };

  // Função para reagir em todos os itens do grupo
  const handleSelectReactionGroup = async (group: Message[], reaction: string) => {
    if (!chatId || !userName) return;
    for (const msg of group) {
      await handleSelectReaction(msg.id, reaction);
    }
  };

  // Novo renderizador
  const renderGroupedItem = ({ item }: { item: Message[] }) => {
    if (item.length === 1) {
      // Mensagem normal
      return renderItem({ item: item[0] });
    }
    // Grupo de imagens
    const isUser = item[0].sender === userName;
    const maxToShow = 9;
    const extraCount = item.length - maxToShow;
    const imagesToShow = item.slice(0, maxToShow).reverse();
    const gridCount = Math.min(item.length, maxToShow);
    const { rows, cols } = getGridLayout(gridCount);
    const cellSize = 100;
    // Montar grid
    let grid: (Message | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
    imagesToShow.forEach((msg, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      grid[row][col] = msg;
    });
    const groupReactions = item[0].reactions || {};
    const groupId = item.map(m => m.id).join('-');

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.friendBubble,
          { padding: 4, alignItems: 'flex-end' },
        ]}
      >
        <View style={{ width: cols * cellSize, height: rows * cellSize, flexDirection: 'column', flexWrap: 'nowrap' }}>
          {grid.map((rowArr, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', flex: 1 }}>
              {rowArr.map((msg, colIdx) => {
                if (!msg) return <View key={colIdx} style={{ width: cellSize, height: cellSize, margin: 2 }} />;
                const flatIdx = rowIdx * cols + colIdx;
                const isLast = flatIdx === maxToShow - 1 || flatIdx === imagesToShow.length - 1;
                const showTime = isLast;
                return (
                  <TouchableOpacity
                    key={msg.id}
                    onPress={() => handleImagePress(msg.image!)}
                    onLongPress={() => openReactionModal(msg.id)}
                    style={{ width: cellSize, height: cellSize, borderRadius: 8, overflow: 'hidden', position: 'relative' }}
                  >
                    <Image
                      source={{ uri: msg.image! }}
                      style={{ width: '100%', height: '100%', margin: 5, borderRadius: 8 }}
                    />
                    {isLast && (
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          backgroundColor: 'rgba(0, 0, 0, 0.51)',
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{
                          color: '#fff',
                          fontSize: 32,
                          fontWeight: 'bold',
                          textShadowColor: '#000',
                          textShadowOffset: { width: 1, height: 1 },
                          textShadowRadius: 4,
                        }}>
                          +{extraCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12 , marginTop: 10, marginRight: 10, marginBottom: 2}}>
          {new Date(item[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' , second: '2-digit'})}
        </Text>
        <View style={styles.reactionsContainer}>
          {Object.entries(groupReactions)
            .filter(([_, users]) => Array.isArray(users) && users.length > 0)
            .map(([reaction, users]) => {
              const reacted = userName ? users.includes(userName) : false;
              return (
                <TouchableOpacity
                  key={reaction}
                  onPress={() => reacted ? handleSelectReactionGroup(item, reaction) : null}
                  style={{ opacity: reacted ? 1 : 0.5 }}
                >
                  <Text style={[styles.reaction, { color: '#fff' }]}>
                    {reaction} {users.length > 0 ? users.length : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </View>
    );
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
      <TouchableOpacity
      onLongPress={() => openReactionModal(item.id)}
      >
        
        {item.image && (
          <TouchableOpacity
            onPress={() => handleImagePress(item.image!)}
            onLongPress={() => openReactionModal(item.id)}
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
          {Object.entries(reactionCounts)
            .filter(([_, users]) => Array.isArray(users) && users.length > 0)
            .map(([reaction, users]) => {
              const reacted = userName ? users.includes(userName) : false;
              return (
                <TouchableOpacity
                  key={reaction}
                  onPress={() => reacted ? handleSelectReaction(item.id, reaction) : null}
                  style={{ opacity: reacted ? 1 : 0.5 }}
                >
                  <Text style={[styles.reaction, { color: '#fff' }]}>
                    {reaction} {users.length > 0 ? users.length : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      </TouchableOpacity>
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.chatTitle, { color: '#FFFFFF' }]}>{headerName}</Text>
            <TouchableOpacity style={styles.moreButton} onPress={() => {
              setEditNameModalVisible(true);
              setNewCustomName(headerName);
            }}>
              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Mensagens */}
          <FlatList
            data={groupedMessages}
            renderItem={renderGroupedItem}
            keyExtractor={item => item.map(m => m.id).join('-')}
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
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: '100%', height: '80%', bottom:'0%', borderRadius: 16, overflow: 'hidden' }}>
                <ImageViewer
                  imageUrls={imageUrls}
                  index={imageViewerIndex}
                  backgroundColor="transparent"
                  enableSwipeDown
                  onSwipeDown={() => setImageViewerVisible(false)}
                  renderIndicator={(currentIndex, allSize) => (
                    <View style={{ alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ color: '#fff' }}>{currentIndex} / {allSize}</Text>
                    </View>
                  )}
                  onClick={() => setImageViewerVisible(false)}
                  saveToLocalByLongPress={false}
                  style={{ borderRadius: 16 }}
                />
              </View>
              {/* Barra de preview e botão de fechar permanecem iguais */}
              <ScrollView
                ref={previewScrollRef}
                horizontal style={{ position: 'absolute', bottom: 30, left: 0, right: 0, paddingHorizontal: 10 }} showsHorizontalScrollIndicator={false}>
                {imageMessages.map((msg, idx) => (
                  <TouchableOpacity
                    key={msg.id}
                    onPress={() => {
                      setImageViewerIndex(idx);
                    }}
                    style={{ marginHorizontal: 4, borderWidth: idx === imageViewerIndex ? 2 : 0, borderColor: '#fff', borderRadius: 6 }}
                  >
                    <Image source={{ uri: msg.image! }} style={{ width: 36, height: 36, borderRadius: 6, opacity: idx === imageViewerIndex ? 1 : 0.7 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.closeImageViewerButton}
                onPress={() => setImageViewerVisible(false)}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Modal para editar nome da conversa */}
          <Modal visible={editNameModalVisible} transparent animationType="fade">
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
              activeOpacity={1}
              onPress={() => setEditNameModalVisible(false)}
            >
              <View style={{ width: '85%', backgroundColor: themeColors.background, borderRadius: 16, padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: themeColors.googleButton, marginBottom: 16 }}>Editar nome da conversa</Text>
                <TextInput
                  value={newCustomName}
                  onChangeText={setNewCustomName}
                  style={{ width: '100%', borderWidth: 1, borderColor: themeColors.tint, borderRadius: 10, padding: 12, color: themeColors.textSearch, marginBottom: 20, backgroundColor: themeColors.backgroundfraco }}
                  placeholder="Novo nome para esta conversa"
                  placeholderTextColor={themeColors.icon}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: themeColors.tint, padding: 12, borderRadius: 10, alignItems: 'center', marginRight: 8 }}
                    onPress={handleChangeCustomName}
                    disabled={savingCustomName || !newCustomName.trim()}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{savingCustomName ? 'Salvando...' : 'Salvar'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: themeColors.backgroundfraco, padding: 12, borderRadius: 10, alignItems: 'center', marginLeft: 8 }}
                    onPress={() => setEditNameModalVisible(false)}
                    disabled={savingCustomName}
                  >
                    <Text style={{ color: themeColors.googleButton, fontWeight: 'bold' }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Modal de reações */}
          <Modal visible={reactionModalVisible} transparent animationType="fade">
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
              activeOpacity={1}
              onPress={() => setReactionModalVisible(false)}
            >
              <View style={{ flexDirection: 'row', backgroundColor: themeColors.background, borderRadius: 16, padding: 10, alignItems: 'center', elevation: 10, borderColor: themeColors.backgroundfundoemoji, borderWidth: 1}}>
                {availableReactions.map((reaction) => {
                  // Busca a mensagem alvo
                  const msg = messages.find(m => m.id === reactionTargetMessageId);
                  const users = msg && Array.isArray(msg.reactions?.[reaction]) ? msg.reactions[reaction] : [];
                  const isActive = users.length > 0;
                  return (
                    <TouchableOpacity
                      key={reaction}
                      onPress={() => reactionTargetMessageId && handleSelectReaction(reactionTargetMessageId, reaction)}
                      style={{
                        margin: 10,
                        backgroundColor: isActive ? themeColors.backgroundfundoemoji : 'transparent',
                        padding: 5,
                        borderRadius: 100,
                        transform: [{ scale: isActive ? 1.2 : 1 }],
                      }}
                    >
                      <Text style={{ fontSize: 32 }}>{reaction}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* CustomAlert */}
          <CustomAlert
            visible={customAlert.visible}
            title={customAlert.title}
            message={customAlert.message}
            buttons={customAlert.buttons}
            onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
          />
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
