import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, query, orderBy, getDocs } from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { fetchUsers, fetchImages, fetchPosts } from '@/utils/firebaseQueries';
import { Colors } from '@/constants/Colors';
import ImageDisplay from '@/components/ImageDisplay';
import { getCachedImage, cacheImage } from '@/utils/imageCache';
import { LinearGradient } from 'expo-linear-gradient';

interface Comment {
  userId: string;
  text: string;
  timestamp: number;
}

interface Post {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
  likes: Record<string, boolean>;
  comments: Record<string, Comment>;
  imageId: string | null;
}

interface User {
  id: string;
  user: string;
  email: string;
}

interface CachedImage {
  id: string;
  base64: string;
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

interface ImageData {
  id: string;
  base64?: string;
  timestamp?: number;
}

interface FormattedPost {
  id: string;
  username: string;
  time: string;
  content: string;
  likes: Record<string, boolean>;
  comments: Record<string, Comment>;
  imageId: string | null;
  timestamp: number;
}

const CACHE_KEY = 'cached_images';
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 dias em milissegundos

const FastShiiiScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [posts, setPosts] = useState<Post[]>([]);
  const [inputText, setInputText] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [createPostModalVisible, setCreatePostModalVisible] = useState(false);
  const [viewPostModalVisible, setViewPostModalVisible] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [switchValue1, setSwitchValue1] = useState(true);
  const [switchValue2, setSwitchValue2] = useState(true);
  const [switchValue3, setSwitchValue3] = useState(true);
  const [choiceChipsValue, setChoiceChipsValue] = useState('Populares');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          console.error('Nenhum usuário encontrado no AsyncStorage.');
          router.replace('/login');
        }
      } catch (error) {
        console.error('Erro ao carregar usuário do AsyncStorage:', error);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    router.replace('/login');
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

  const handleTakePhoto = async () => {
    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Permissão Negada', 'Você precisa conceder permissão para usar a câmera.');
        return;
      }
    }
    setCameraModalVisible(true);
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo) {
          setSelectedImage(photo.uri);
          setCameraModalVisible(false);
        }
      } catch (error) {
        console.error('Erro ao capturar foto:', error);
        Alert.alert('Erro', 'Não foi possível capturar a foto.');
      }
    }
  };

  const handleAddPost = async () => {
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    if (!inputText.trim() && !selectedImage) {
      Alert.alert('Erro', 'Por favor, insira algum texto ou carregue uma imagem.');
      return;
    }

    setPosting(true);

    try {
      let imageId = null;

      if (selectedImage) {
        const compressedImage = await ImageManipulator.manipulateAsync(
          selectedImage,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        const fotoBase64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fotoData = {
          base64: fotoBase64,
          timestamp: Date.now(),
        };
        const docRef = await addDoc(collection(firestore, 'fotos'), fotoData);
        imageId = docRef.id;
      }

      const postData: Omit<Post, 'id'> = {
        userId: user.id,
        text: inputText || '',
        timestamp: Date.now(),
        likes: {},
        comments: {},
        imageId: imageId,
      };

      const postDocRef = await addDoc(collection(firestore, 'posts'), postData);
      console.log('Postagem salva com ID:', postDocRef.id);

      Alert.alert('Sucesso', 'Postagem adicionada com sucesso!');
      setInputText('');
      setSelectedImage(null);
      setCreatePostModalVisible(false);
    } catch (error: any) {
      console.error('Erro ao adicionar postagem:', error.message);
      Alert.alert('Erro', 'Erro ao adicionar postagem: ' + error.message);
    } finally {
      setPosting(false);
    }
  };

  const cacheImage = async (imageId: string, base64: string) => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      const now = Date.now();
      let cache = cachedData ? JSON.parse(cachedData) : { images: [], timestamp: now };

      // Check if the image is already cached
      const isCached = cache.images.some((img: CachedImage) => img.id === imageId);
      if (!isCached) {
        console.log(`Caching new image with ID: ${imageId}`);
        cache.images.push({ id: imageId, base64 });
        cache.timestamp = now; // Update the timestamp
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.error('Erro ao salvar imagem no cache:', error);
    }
  };

  const fetchImagesWithCache = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      const now = Date.now();

      if (cachedData) {
        const { images, timestamp } = JSON.parse(cachedData);

        // Check if the cache is still valid
        if (now - timestamp < CACHE_DURATION) {
          console.log('Using cached images');
          return images; // Return cached images
        }
      }

      console.log('Fetching new images from Firestore');
      const images = await fetchImages(); // Fetch images from Firestore

      // Cache the new images with the current timestamp
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ images, timestamp: now })
      );

      return images;
    } catch (error) {
      console.error('Erro ao buscar ou salvar imagens no cache:', error);
      return [];
    }
  };

  const fetchAndCacheImages = async () => {
    try {
      const images = await fetchImages();
      const now = Date.now();

      for (const image of images) {
        if ('base64' in image) {
          const cachedImage = await getCachedImage(image.id);
          if (!cachedImage) {
            console.log(`Caching image with ID: ${image.id}`);
            await cacheImage(image.id, image.base64);
          }
        }
      }

      console.log('All images have been cached.');
    } catch (error) {
      console.error('Erro ao buscar e armazenar imagens no cache:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const users = await fetchUsers();
        await fetchAndCacheImages();
        const posts = await fetchPosts();

        const formattedPosts = posts.map((post: Post): FormattedPost => {
          const user = users.find((u: User) => u.id === post.userId) || { id: '', user: 'Usuário Desconhecido', email: '' };

          const postTime = new Date(post.timestamp);
          const currentTime = new Date();
          const timeDifference = Math.floor((currentTime.getTime() - postTime.getTime()) / 1000);

          let timeString = '';
          if (timeDifference < 60) {
            timeString = `${timeDifference} segundos atrás`;
          } else if (timeDifference < 3600) {
            timeString = `${Math.floor(timeDifference / 60)} minutos atrás`;
          } else if (timeDifference < 86400) {
            timeString = `${Math.floor(timeDifference / 3600)} horas atrás`;
          } else {
            timeString = `${Math.floor(timeDifference / 86400)} dias atrás`;
          }

          return {
            id: post.id,
            username: user.user,
            time: timeString,
            content: post.text,
            likes: post.likes || {},
            comments: post.comments || {},
            imageId: post.imageId || null,
            timestamp: post.timestamp,
          };
        });

        const sortedPosts =
          choiceChipsValue === 'Populares'
            ? formattedPosts.sort((a, b) => {
                const aScore = (Object.keys(a.likes).length + Object.keys(a.comments).length) / 2;
                const bScore = (Object.keys(b.likes).length + Object.keys(b.comments).length) / 2;
                return bScore - aScore;
              })
            : formattedPosts.sort((a, b) => b.timestamp - a.timestamp);

        setPosts(sortedPosts);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [choiceChipsValue]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const users = await fetchUsers();
      await fetchAndCacheImages();
      const posts = await fetchPosts();

      const formattedPosts = posts.map((post: Post): FormattedPost => {
        const user = users.find((u: User) => u.id === post.userId) || { id: '', user: 'Usuário Desconhecido', email: '' };

        const postTime = new Date(post.timestamp);
        const currentTime = new Date();
        const timeDifference = Math.floor((currentTime.getTime() - postTime.getTime()) / 1000);

        let timeString = '';
        if (timeDifference < 60) {
          timeString = `${timeDifference} segundos atrás`;
        } else if (timeDifference < 3600) {
          timeString = `${Math.floor(timeDifference / 60)} minutos atrás`;
        } else if (timeDifference < 86400) {
          timeString = `${Math.floor(timeDifference / 3600)} horas atrás`;
        } else {
          timeString = `${Math.floor(timeDifference / 86400)} dias atrás`;
        }

        return {
          id: post.id,
          username: user.user,
          time: timeString,
          content: post.text,
          likes: post.likes || {},
          comments: post.comments || {},
          imageId: post.imageId || null,
          timestamp: post.timestamp,
        };
      });

      const sortedPosts =
        choiceChipsValue === 'Populares'
          ? formattedPosts.sort((a, b) => Object.keys(b.likes).length + Object.keys(b.comments).length - (Object.keys(a.likes).length + Object.keys(a.comments).length))
          : formattedPosts.sort((a, b) => b.timestamp - a.timestamp);

      setPosts(sortedPosts);
    } catch (error) {
      console.error('Erro ao recarregar os posts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChipSelection = (value: string) => {
    setChoiceChipsValue(value);
    setLoading(true);
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar autenticado para curtir um post.');
      return;
    }

    try {
      const postRef = doc(firestore, 'posts', postId);
      const isLiked = posts.find((post) => post.id === postId)?.likes[user.id];

      if (isLiked) {
        await updateDoc(postRef, {
          [`likes.${user.id}`]: false,
        });
      } else {
        await updateDoc(postRef, {
          [`likes.${user.id}`]: true,
        });
      }

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: {
                  ...post.likes,
                  [user.id]: !isLiked,
                },
              }
            : post
        )
      );
    } catch (error) {
      console.error('Erro ao curtir o post:', error);
      Alert.alert('Erro', 'Não foi possível curtir o post.');
    }
  };

  const handleCommentPost = async (postId: string, commentText: string) => {
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar autenticado para comentar em um post.');
      return;
    }

    if (!commentText.trim()) {
      Alert.alert('Erro', 'O comentário não pode estar vazio.');
      return;
    }

    try {
      const postRef = doc(firestore, 'posts', postId);
      const commentId = `${user.id}_${Date.now()}`;

      await updateDoc(postRef, {
        [`comments.${commentId}`]: {
          userId: user.id,
          text: commentText,
          timestamp: Date.now(),
        },
      });

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: {
                  ...post.comments,
                  [commentId]: {
                    userId: user.id,
                    text: commentText,
                    timestamp: Date.now(),
                  },
                },
              }
            : post
        )
      );
    } catch (error) {
      console.error('Erro ao comentar no post:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o comentário.');
    }
  };

  const handleMorePress = (username: string) => {
    setSelectedUser(username);
    setMoreOptionsVisible(true);
  };

  const handleBlockUser = () => {
    Alert.alert('Usuário Bloqueado', `Você bloqueou o usuário ${selectedUser}.`);
    setMoreOptionsVisible(false);
  };

  const handleGoToProfile = () => {
    router.push({
      pathname: `/SubTelas/perfil_outros`,
      params: { usernome: selectedUser },
    });
    setMoreOptionsVisible(false);
  };

  const renderPost = ({ item }: { item: FormattedPost }) => {
    const isLiked = user?.id ? !!item.likes[user.id] : false;
    const likeCount = Object.keys(item.likes || {}).filter((key) => item.likes[key]).length;
    const commentCount = Object.keys(item.comments || {}).length;

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedPost(item as unknown as Post);
          setViewPostModalVisible(true);
        }}
      >
        <View style={[styles.postContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.postHeader}>
            <Text style={[styles.postUsername, { color: themeColors.tint }]}>{item.username}</Text>
            <TouchableOpacity
              style={[styles.iconButton_trez, { borderColor: themeColors.googleButton }]}
              onPress={() => handleMorePress(item.username)}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={themeColors.googleButton} />
            </TouchableOpacity>
          </View>
          {item.imageId && (
            <ImageDisplay imageId={item.imageId} style={styles.postImage} />
          )}
          <Text style={[styles.postContent, { color: themeColors.googleButton }]}>{item.content}</Text>
          <View style={styles.postFooter}>
            <View style={styles.postActions}>
              <TouchableOpacity
                style={[
                  styles.iconButton,
                  { backgroundColor: isLiked ? themeColors.tint : 'transparent' },
                ]}
                onPress={() => handleLikePost(item.id)}
              >
                <Ionicons
                  name="thumbs-up-outline"
                  size={20}
                  color={isLiked ? '#fff' : themeColors.googleButton}
                />
              </TouchableOpacity>
              <Text style={[styles.postActionText, { color: themeColors.googleButton }]}>
                {likeCount}
              </Text>
              <TouchableOpacity
                style={[styles.iconButton, { borderColor: themeColors.googleButton }]}
                onPress={() =>
                  Alert.prompt(
                    'Adicionar Comentário',
                    'Escreva seu comentário:',
                    [
                      {
                        text: 'Cancelar',
                        style: 'cancel',
                      },
                      {
                        text: 'Enviar',
                        onPress: (commentText) => handleCommentPost(item.id, commentText || ''),
                      },
                    ],
                    'plain-text'
                  )
                }
              >
                <Ionicons name="chatbubble-outline" size={20} color={themeColors.googleButton} />
              </TouchableOpacity>
              <Text style={[styles.postActionText, { color: themeColors.googleButton }]}>
                {commentCount}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Chip: React.FC<ChipProps> = ({ label, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
      onPress={onPress}
    >
      <Text style={selected ? styles.chipTextSelected : styles.chipTextUnselected}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const handleViewCommentPrivacy = () => {
    Alert.alert('Configuração', 'Aqui você pode configurar quem pode ver seus comentários.');
  };

  const handleBlockedUsers = () => {
    Alert.alert('Configuração', 'Aqui você pode gerenciar os usuários bloqueados.');
  };

  const handleNotificationToggle = (type: string, value: boolean) => {
    switch (type) {
      case 'commentReplies':
        setSwitchValue1(value);
        break;
      case 'commentLikes':
        setSwitchValue2(value);
        break;
      case 'popularTopics':
        setSwitchValue3(value);
        break;
      default:
        console.error('Tipo de notificação desconhecido:', type);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: themeColors.tint }]}>
          <Text style={[styles.appBarTitle, { color: '#fff' }]}>S H I I I I</Text>
          <TouchableOpacity 
            onPress={() => setDrawerVisible(true)} 
            style={[styles.appBarIcon, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
          >
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* End Drawer implementado via Modal */}
        <Modal visible={drawerVisible} animationType="slide" transparent>
          <TouchableOpacity
            style={styles.drawerOverlay}
            onPress={() => setDrawerVisible(false)}
          />
          <View style={[styles.drawer, { backgroundColor: themeColors.background }]}>
            <ScrollView contentContainerStyle={styles.drawerContent}>
              <Text style={[styles.drawerTitle, { color: themeColors.tint }]}>Configurações</Text>

              <Text style={[styles.drawerSubtitle, { color: themeColors.googleButton }]}>Privacidade</Text>
              <TouchableOpacity
                style={[styles.drawerOption, { backgroundColor: themeColors.icon }]}
                onPress={handleViewCommentPrivacy}>
                <Text style={[styles.drawerOptionText, { color: themeColors.googleButton }]}>Quem pode ver meus comentários</Text>
                <Ionicons name="chevron-forward-outline" size={24} color={themeColors.tint} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.drawerOption, { backgroundColor: themeColors.icon }]}
                onPress={handleBlockedUsers}>
                <Text style={[styles.drawerOptionText, { color: themeColors.googleButton }]}>Usuários bloqueados</Text>
                <Ionicons name="chevron-forward-outline" size={24} color={themeColors.tint} />
              </TouchableOpacity>

              <Text style={[styles.drawerSubtitle, { color: themeColors.googleButton, marginTop: 20 }]}>Notificações</Text>
              <View style={[styles.drawerOption, { backgroundColor: themeColors.icon }]}>
                <Text style={[styles.drawerOptionText, { color: themeColors.googleButton }]}>Respostas aos meus comentários</Text>
                <Switch
                  value={switchValue1}
                  onValueChange={(value) => handleNotificationToggle('commentReplies', value)}
                  trackColor={{ false: themeColors.icon, true: themeColors.tint }}
                  thumbColor={switchValue1 ? themeColors.googleButton : themeColors.googleButton}
                />
              </View>
              <View style={[styles.drawerOption, { backgroundColor: themeColors.icon }]}>
                <Text style={[styles.drawerOptionText, { color: themeColors.googleButton }]}>Curtidas nos meus comentários</Text>
                <Switch
                  value={switchValue2}
                  onValueChange={(value) => handleNotificationToggle('commentLikes', value)}
                  trackColor={{ false: themeColors.icon, true: themeColors.tint }}
                  thumbColor={switchValue2 ? themeColors.googleButton : themeColors.googleButton}
                />
              </View>
              <View style={[styles.drawerOption, { backgroundColor: themeColors.icon }]}>
                <Text style={[styles.drawerOptionText, { color: themeColors.googleButton }]}>Tópicos populares</Text>
                <Switch
                  value={switchValue3}
                  onValueChange={(value) => handleNotificationToggle('popularTopics', value)}
                  trackColor={{ false: themeColors.icon, true: themeColors.tint }}
                  thumbColor={switchValue3 ? themeColors.googleButton : themeColors.googleButton}
                />
              </View>
              <TouchableOpacity
                style={[styles.drawerButton, { borderColor: themeColors.tint }]}
                onPress={handleLogout}>
                <Text style={[styles.drawerButtonText, { color: themeColors.tint }]}>Sair da conta</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Corpo da tela */}
        <View style={styles.body}>
          {/* Campo de Input */}
          <View style={[styles.inputContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            <TextInput
              style={[
                styles.input,
                { color: themeColors.googleButton }
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Compartilhe seus pensamentos..."
              placeholderTextColor={'rgba(255,255,255,0.5)'}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => setCreatePostModalVisible(true)}
            >
              <Ionicons name="add" size={24} color={themeColors.googleButton} />
            </TouchableOpacity>
          </View>

          {/* Choice Chips */}
          <View style={styles.chipsContainer}>
            <Chip
              label="Populares"
              selected={choiceChipsValue === 'Populares'}
              onPress={() => handleChipSelection('Populares')}
            />
            <Chip
              label="Recentes"
              selected={choiceChipsValue === 'Recentes'}
              onPress={() => handleChipSelection('Recentes')}
            />
          </View>

          {/* Lista de Posts */}
          {loading ? (
            <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={renderPost}
              contentContainerStyle={styles.postsList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              )}
            />
          )}
        </View>

        {/* Modal para adicionar nova postagem */}
        <Modal visible={createPostModalVisible} transparent={true} animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setCreatePostModalVisible(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
              <Text style={[styles.modalTitle, { color: '#fff' }]}>Nova Postagem</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)'
                  }
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Escreva algo..."
                placeholderTextColor={'rgba(255,255,255,0.5)'}
              />
              {selectedImage && (
                <Image source={{ uri: selectedImage }} style={styles.dynamicImage} />
              )}
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                  onPress={handleImagePicker}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Carregar Imagem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: themeColors.tint }]}
                  onPress={handleTakePhoto}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Tirar Foto</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                {posting ? (
                  <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.modalActionButton, { backgroundColor: themeColors.tint }]}
                      onPress={handleAddPost}
                    >
                      <Text style={[styles.modalActionButtonText, { color: '#fff' }]}>Postar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                      onPress={() => setCreatePostModalVisible(false)}
                    >
                      <Text style={[styles.modalActionButtonText, { color: '#fff' }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal da câmera */}
        <Modal visible={cameraModalVisible} transparent={false} animationType="slide">
          <View style={styles.cameraContainer}>
            <CameraView style={styles.camera} ref={cameraRef} />
            <TouchableOpacity 
              style={[styles.captureButton, { backgroundColor: themeColors.tint }]} 
              onPress={handleCapturePhoto}
            >
              <Text style={styles.captureButtonText}>Capturar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.closeCameraButton, { backgroundColor: themeColors.tint }]}
              onPress={() => setCameraModalVisible(false)}
            >
              <Text style={styles.closeCameraButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Modal>
        
        {/* Modal para visualizar post */}
        <Modal visible={viewPostModalVisible} transparent={true} animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setViewPostModalVisible(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
              <TouchableOpacity 
                style={[styles.modalClose, { backgroundColor: 'rgba(255,3,3,0.8)' }]} 
                onPress={() => setViewPostModalVisible(false)}
              >
                <Text style={[styles.modalCloseText, { color: '#fff' }]}>X</Text>
              </TouchableOpacity>
              {selectedPost && (
                <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
                  <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>
                    {selectedPost.username}
                  </Text>
                  <Text style={[styles.modalTime, { color: themeColors.googleButton }]}>
                    {selectedPost.time}
                  </Text>
                  <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                    {selectedPost.content}
                  </Text>
                  {selectedPost.imageId && (
                    <ImageDisplay
                      imageId={selectedPost.imageId}
                      style={styles.dynamicImage}
                    />
                  )}
                  <View style={styles.modalFooter}>
                    <Text style={[styles.modalLikes, { color: themeColors.googleButton }]}>
                      Curtidas: {Object.keys(selectedPost.likes).filter((key) => selectedPost.likes[key]).length}
                    </Text>
                    <Text style={[styles.modalComments, { color: themeColors.googleButton }]}>
                      Comentários: {Object.keys(selectedPost.comments).length}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal de mais opções */}
        <Modal visible={moreOptionsVisible} transparent={true} animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMoreOptionsVisible(false)}
          >
            <View style={[styles.moreOptionsContainer, { backgroundColor: themeColors.background }]}>
              <TouchableOpacity
                style={[styles.moreOptionButton, { backgroundColor: themeColors.tint }]}
                onPress={handleBlockUser}
              >
                <Text style={[styles.moreOptionText, { color: '#fff' }]}>Bloquear Usuário</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moreOptionButton, { backgroundColor: themeColors.tint }]}
                onPress={handleGoToProfile}
              >
                <Text style={[styles.moreOptionText, { color: '#fff' }]}>Ir para o Perfil</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </LinearGradient>
    </View>
  );
};

export default FastShiiiScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  appBar: {
    marginTop: 35,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
    marginHorizontal: 16,
  },
  appBarTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  appBarIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  chipSelected: {
    backgroundColor: '#ff5500',
  },
  chipUnselected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  chipTextUnselected: {
    color: 'rgba(255,255,255,0.7)',
  },
  postContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postUsername: {
    fontSize: 16,
    fontWeight: '700',
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 12,
  },
  iconButton_trez: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  postActionText: {
    fontSize: 14,
    marginRight: 16,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },
  postsList: {
    paddingBottom: 16,
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  moreOptionsContainer: {
    width: '80%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  moreOptionButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  moreOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 380,
    backgroundColor: '#151142',
    elevation: 16,
    paddingTop: 60,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  drawerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff5500',
    marginBottom: 24,
    textAlign: 'center',
  },
  drawerSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  drawerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E3F',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  drawerOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  drawerButton: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FF0000',
    borderRadius: 8,
    alignItems: 'center',
  },
  drawerButtonText: {
    fontSize: 16,
    color: '#FF0000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.73)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  captureButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#ff5500',
    padding: 15,
    borderRadius: 50,
  },
  captureButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeCameraButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#ff5500',
    padding: 10,
    borderRadius: 8,
    zIndex: 999,
  },
  closeCameraButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 3, 3, 0.8)',
    borderRadius: 8,
    zIndex: 999,
  },
  modalCloseText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTime: {
    fontSize: 14,
    color: '#000',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    height: '60%',
    marginBottom: 16,
    borderRadius: 8,
    resizeMode: 'contain', 
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalLikes: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
  modalComments: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
  dynamicImage: {
    width: '100%',
    marginHorizontal: 2,
    aspectRatio: 0.8,
    resizeMode: 'contain',
  },
});
