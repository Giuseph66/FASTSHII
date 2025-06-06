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
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { fetchUsers, fetchImages, fetchPosts } from '@/utils/firebaseQueries';
import { Colors } from '@/constants/Colors';
import ImageDisplay from '@/components/ImageDisplay';
import { getCachedImage, cacheImage } from '@/utils/imageCache';
import { LinearGradient } from 'expo-linear-gradient';
import { Background } from '@react-navigation/elements';
import { ThemeContext } from '@react-navigation/native';

interface Comment {
  userId: string;
  text: string;
  timestamp: number;
}

interface Post {
  id: string;
  userId: string;
  username: string;
  content: string;
  text: string;
  timestamp: number;
  likes: Record<string, boolean>;
  comments: Record<string, Comment>;
  imageBase64: string | null;
}

interface User {
  uid: string;
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
  userId: string;
  time: string;
  content: string;
  likes: Record<string, boolean>;
  comments: Record<string, Comment>;
  imageBase64: string | null;
  timestamp: number;
}

interface PaginationState {
  lastVisible: any;
  hasMore: boolean;
  pageSize: number;
}

interface ImageDisplayProps {
  imageId: string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

const CACHE_KEY = 'cached_images';
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 dias em milissegundos

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('screen').width;
const screenHeight = Dimensions.get('screen').height;

const imageSize = Math.min(windowWidth, windowHeight * 0.8);
const postWidth = windowWidth - 32; // 16px de padding em cada lado
const posheight = windowHeight / 4;
const aspectRatio = 1; // Proporção quadrada

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    lastVisible: null,
    hasMore: true,
    pageSize: 10
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [blockConfirmModalVisible, setBlockConfirmModalVisible] = useState(false);
  const [blockUsername, setBlockUsername] = useState('');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          console.error('Nenhum usuário encontrado no AsyncStorage.');
          router.replace('/login');
          return;
        }

        // Iniciar pré-carregamento de imagens
        await preloadImages();
        
        // Buscar posts após as imagens estarem carregadas
        await fetchPostsWithPagination(true);
      } catch (error) {
        console.error('Erro ao inicializar app:', error);
      }
    };

    initializeApp();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');

    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => router.replace('/login') },
      ]
    );
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
      let imageBase64 = null;

      if (selectedImage) {
        // Apenas converte para JPEG e base64, sem crop ou resize
        const compressedImage = await ImageManipulator.manipulateAsync(
          selectedImage,
          [],
          { 
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true
          }
        );
        if (compressedImage.base64) {
          imageBase64 = compressedImage.base64;
        }
      }

      const postData: Omit<Post, 'id'> = {
        userId: user.uid,
        username: user.user,
        content: inputText || '',
        text: inputText || '',
        timestamp: Date.now(),
        likes: {},
        comments: {},
        imageBase64: imageBase64,
      };

      const postDocRef = await addDoc(collection(firestore, 'posts'), postData);
      console.log('Postagem salva com ID:', postDocRef.id);

      Alert.alert('Sucesso', 'Postagem adicionada com sucesso!');
      setInputText('');
      setSelectedImage(null);
      setCreatePostModalVisible(false);
    } catch (error: any) {
      console.error('Erro ao adicionar postagem:', error.message);
      Alert.alert('Erro vai se foder', 'Erro ao adicionar postagem:  ' + error.message);
    } finally {
      setPosting(false);
    }
  };

  const cacheImage = async (imageId: string, base64: string) => {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      const now = Date.now();
      let cache = cachedData ? JSON.parse(cachedData) : { images: [], timestamp: now };

      // Limitar o tamanho do cache
      const MAX_CACHE_SIZE = 50;
      if (cache.images.length >= MAX_CACHE_SIZE) {
        // Remover imagens mais antigas
        cache.images = cache.images.slice(-MAX_CACHE_SIZE);
      }

      // Verificar se a imagem já está em cache
      const existingImageIndex = cache.images.findIndex((img: CachedImage) => img.id === imageId);
      if (existingImageIndex !== -1) {
        // Atualizar timestamp da imagem existente
        cache.images[existingImageIndex].timestamp = now;
      } else {
        // Adicionar nova imagem
        cache.images.push({ id: imageId, base64, timestamp: now });
      }

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
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

        // Verificar se o cache ainda é válido
        if (now - timestamp < CACHE_DURATION) {
          return images;
        }
      }

      // Buscar apenas imagens necessárias
      const images = await fetchImages();
      const newCache = {
        images: images.slice(0, 50), // Limitar a 50 imagens
        timestamp: now
      };

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      return newCache.images;
    } catch (error) {
      console.error('Erro ao buscar imagens do cache:', error);
      return [];
    }
  };

  const fetchPostsWithPagination = async (isInitialLoad = false) => {
    if (!isInitialLoad && (!pagination.hasMore || isLoadingMore)) return;

    setIsLoadingMore(true);
    try {
      const postsRef = collection(firestore, 'posts');
      let queryRef = query(postsRef, orderBy('timestamp', 'desc'), limit(pagination.pageSize));

      if (!isInitialLoad && pagination.lastVisible) {
        queryRef = query(
          postsRef,
          orderBy('timestamp', 'desc'),
          startAfter(pagination.lastVisible),
          limit(pagination.pageSize)
        );
      }

      const snapshot = await getDocs(queryRef);
      const newPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      const hasMore = snapshot.docs.length === pagination.pageSize;

      setPagination(prev => ({
        ...prev,
        lastVisible,
        hasMore
      }));

      // Buscar usuários em paralelo
      const users = await fetchUsers() as User[];
      
      // Formatar posts com informações de usuário e tempo
      const formattedPosts = newPosts.map((post: Post): FormattedPost => {
        const user = users.find((u: User) => u.uid === post.userId);
        const username = user?.user || 'Usuário Desconhecido';

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
          userId: post.userId,
          username: username,
          time: timeString,
          content: post.text,
          likes: post.likes || {},
          comments: post.comments || {},
          imageBase64: post.imageBase64 || null,
          timestamp: post.timestamp,
        };
      });

      // Ordenar posts baseado na escolha do usuário
      const sortedPosts = choiceChipsValue === 'Populares'
        ? formattedPosts.sort((a, b) => {
            const aScore = (Object.keys(a.likes).length + Object.keys(a.comments).length) / 2;
            const bScore = (Object.keys(b.likes).length + Object.keys(b.comments).length) / 2;
            return bScore - aScore;
          })
        : formattedPosts.sort((a, b) => b.timestamp - a.timestamp);

      if (isInitialLoad) {
        setPosts(sortedPosts as unknown as Post[]);
      } else {
        setPosts(prev => [...prev, ...sortedPosts] as unknown as Post[]);
      }

      // Carregar imagens em background
      const imageIds = newPosts
        .filter(post => post.imageBase64)
        .map(post => post.imageBase64 as string);

      if (imageIds.length > 0) {
        fetchImagesWithCache().then(cachedImages => {
          const missingImages = imageIds.filter(id => 
            !cachedImages.some((img: CachedImage) => img.id === id)
          );

          if (missingImages.length > 0) {
            fetchImages().then(images => {
              missingImages.forEach(id => {
                const image = images.find((img: ImageData) => img.id === id);
                if (image?.base64) {
                  cacheImage(id, image.base64);
                }
              });
            });
          }
        });
      }
    } catch (error) {
      console.error('Erro ao buscar posts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
      try {
        const users = await fetchUsers();
      await fetchPostsWithPagination(true);
    } catch (error) {
      console.error('Erro ao recarregar os posts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChipSelection = async (value: string) => {
    setChoiceChipsValue(value);
    setLoading(true);
    try {
      // Resetar a paginação
      setPagination({
        lastVisible: null,
        hasMore: true,
        pageSize: 10
      });
      
      // Buscar posts novamente com a nova ordenação
      await fetchPostsWithPagination(true);
      } catch (error) {
      console.error('Erro ao mudar ordenação:', error);
      } finally {
      setLoading(false);
      }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar autenticado para curtir um post.');
      return;
    }

    try {
      const postRef = doc(firestore, 'posts', postId);
      const isLiked = posts.find((post) => post.id === postId)?.likes[user.uid];

      if (isLiked) {
        await updateDoc(postRef, {
          [`likes.${user.uid}`]: false,
        });
      } else {
        await updateDoc(postRef, {
          [`likes.${user.uid}`]: true,
        });
      }

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: {
                  ...post.likes,
                  [user.uid]: !isLiked,
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
      const commentId = `${user.uid}_${Date.now()}`;

      await updateDoc(postRef, {
        [`comments.${commentId}`]: {
          userId: user.uid,
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
                    userId: user.uid,
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
    setBlockUsername('');
    setBlockConfirmModalVisible(true);
  };

  const handleConfirmBlock = () => {
    if (blockUsername.trim() === selectedUser) {
      Alert.alert(
        'Usuário Bloqueado',
        `Você bloqueou o usuário ${blockUsername}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setBlockConfirmModalVisible(false);
    setMoreOptionsVisible(false);
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Erro',
        'O nome digitado não corresponde ao usuário selecionado. Por favor, verifique e tente novamente.',
        [
          {
            text: 'OK',
            onPress: () => {
              setBlockUsername('');
            }
          }
        ]
      );
    }
  };

  const handleUsernamePress = (username: string, userId: string) => {
    setSelectedUser(username);
    console.log(userId);
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  const renderPost = ({ item }: { item: FormattedPost }) => {
    const isLiked = user?.uid ? !!item.likes[user.uid] : false;
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
            <TouchableOpacity onPress={() => handleUsernamePress(item.username, item.userId)}>
              <Text style={[styles.postUsername, { color: themeColors.tint }]}>{item.username}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton_trez, { borderColor: themeColors.googleButton }]}
              onPress={() => handleMorePress(item.username)}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={themeColors.googleButton} />
            </TouchableOpacity>
          </View>
          {item.imageBase64 && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }}
                style={styles.postImage}
                resizeMode="cover"
              />
              {!imagesLoaded && (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator size="large" color={themeColors.tint} />
                </View>
              )}
            </View>
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
      style={[styles.chip, selected ? {backgroundColor: themeColors.tint } : styles.chipUnselected]}
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

  const handleLoadMore = () => {
    if (!isLoadingMore && pagination.hasMore) {
      fetchPostsWithPagination(false);
    }
  };

  const preloadImages = async () => {
    try {
      setLoading(true);
      const images = await fetchImages();
      
      // Limitar o número de imagens para pré-carregar
      const imagesToPreload = images.slice(0, 20);
      
      // Pré-carregar imagens em paralelo
      await Promise.all(
        imagesToPreload.map(async (image) => {
          if (image.base64) {
            await cacheImage(image.id, image.base64);
          }
        })
      );
      
      setImagesLoaded(true);
    } catch (error) {
      console.error('Erro ao pré-carregar imagens:', error);
    } finally {
      setLoading(false);
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
          <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundfraco }]}>
              <TextInput
                style={[
                  styles.input,
                { color: themeColors.googleButton }
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Compartilhe seus pensamentos..."
              placeholderTextColor={themeColors.textSearch}
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
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={() => 
                isLoadingMore ? (
                  <ActivityIndicator size="small" color={themeColors.tint} style={styles.loadingMoreIndicator} />
                ) : null
              }
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              )}
            />
          )}
          </View>

        {/* Modal para adicionar nova postagem */}
        <Modal visible={createPostModalVisible} transparent={false} animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setCreatePostModalVisible(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
              <Text style={[styles.modalTitle, { color: themeColors.textSearch }]}>Nova Postagem</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { 
                    backgroundColor: themeColors.backgroundfraco,
                    color: themeColors.textSearch,
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
                      style={[styles.modalActionButton, { backgroundColor: themeColors.backgroundfraco }]}
                      onPress={() => setCreatePostModalVisible(false)}
                    >
                      <Text style={[styles.modalActionButtonText, { color: themeColors.textSearch }]}>Cancelar</Text>
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
                  <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                    {selectedPost.content}
                  </Text>
                  {selectedPost.imageBase64 && (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${selectedPost.imageBase64}` }}
                      style={styles.dynamicImage}
                      resizeMode="cover"
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
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal do Perfil */}
        <Modal visible={profileModalVisible} transparent={true} animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setProfileModalVisible(false)}
          >
            <View style={[styles.moreOptionsContainer, { backgroundColor: themeColors.background }]}>
            <TouchableOpacity
              style={[styles.moreOptionButton, { backgroundColor: themeColors.tint }]}
                onPress={() => {
                  router.push({
                    pathname: `/SubTelas/perfil_outros`,
                    params: { userid: selectedUserId as string },
                  });
                  setProfileModalVisible(false);
                }}
              >
                <Text style={[styles.moreOptionText, { color: '#fff' }]}>Ver Perfil</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

        {/* Modal de Confirmação de Bloqueio */}
        <Modal visible={blockConfirmModalVisible} transparent={true} animationType="fade">
          <TouchableOpacity
            style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            activeOpacity={1}
            onPress={() => setBlockConfirmModalVisible(false)}
          >
            <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
              <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>Bloquear Usuário</Text>
              <Text style={[styles.modalSubtitle, { color: themeColors.googleButton }]}>
                Digite o nome do usuário que deseja bloquear:
              </Text>
              
              {/* Nome do Usuário Flutuante */}
              <TouchableOpacity 
                style={[
                  styles.floatingUsername,
                  { 
                    position: 'absolute',
                    top: '-30%',
                    left: 20,
                    right: 20,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                    zIndex: 1,
                  }
                ]}
                onPress={() => {
                  const parts = selectedUser?.split(' ') || [];
                  let currentIndex = 0;
                  const interval = setInterval(() => {
                    if (currentIndex < parts.length) {
                      setBlockUsername(prev => prev + (prev ? ' ' : '') + parts[currentIndex]);
                      currentIndex++;
                    } else {
                      clearInterval(interval);
                    }
                  }, 200);
                }}
              >
                <Text style={[styles.floatingUsernameText, { color: themeColors.googleButton }]}>
                  {selectedUser}
                </Text>
              </TouchableOpacity>

              <TextInput
                style={[
                  styles.modalInput,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                    padding: 16,
                    fontSize: 16,
                    borderRadius: 12,
                    marginVertical: 16,
                  }
                ]}
                value={blockUsername}
                onChangeText={setBlockUsername}
                placeholder="Digite o nome do usuário"
                placeholderTextColor={'rgba(255,255,255,0.5)'}
                autoFocus={true}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, { backgroundColor: themeColors.tint }]}
                  onPress={handleConfirmBlock}
                >
                  <Text style={[styles.modalActionButtonText, { color: '#fff' }]}>Bloquear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                  onPress={() => setBlockConfirmModalVisible(false)}
                >
                  <Text style={[styles.modalActionButtonText, { color: '#fff' }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
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
    alignItems: 'center',
  },
  inputContainer: {
    width: postWidth,
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
    width: postWidth,
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
    width: postWidth,
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
    width: postWidth,
    height: postWidth * aspectRatio,
    backgroundColor: 'transparent',
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
    width: postWidth,
    paddingBottom: 16,
  },
  modalContent: {
    width: postWidth + 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    maxHeight: windowHeight * 0.8,
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
    width: Math.min(windowWidth * 0.8, 300),
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
    width: Math.min(windowWidth * 0.8, 380),
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
    width: windowWidth,
    height: windowHeight,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  camera: {
    width: windowWidth,
    height: windowHeight,
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
    width: postWidth,
    height: postWidth * aspectRatio,
    marginBottom: 16,
    borderRadius: 8,
    resizeMode: 'cover',
    backgroundColor: 'transparent',
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
    width: postWidth,
    height: posheight * aspectRatio,
    marginBottom: 10 ,
    backgroundColor: 'transparent',
    borderRadius: 10,
  },
  loadingMoreIndicator: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  imageLoadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  imageErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  imageErrorText: {
    color: '#ff5500',
    marginTop: 8,
    fontSize: 14,
  },
  imageContainer: {
    position: 'relative',
    width: postWidth,
    height: postWidth * aspectRatio,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  floatingUsername: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1,
  },
  floatingUsernameText: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
});
