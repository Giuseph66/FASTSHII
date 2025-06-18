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
  Image,
  RefreshControl,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc, doc, updateDoc, setDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, where, limit, startAfter, getDoc, onSnapshot, increment } from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { fetchUsers, fetchImages, fetchPosts } from '@/utils/firebaseQueries';
import { Colors } from '@/constants/Colors';
import ImageDisplay from '@/components/ImageDisplay';
import { getCachedImage, cacheImage } from '@/utils/imageCache';
import { LinearGradient } from 'expo-linear-gradient';
import { Background } from '@react-navigation/elements';
import { ThemeContext } from '@react-navigation/native';
import BlockUserModal from '@/components/BlockUserModal';
import CustomAlert from '@/components/CustomAlert';
import ImageViewer from 'react-native-image-zoom-viewer';

interface Comment {
  userId: string;
  text: string;
  timestamp: number;
  username?: string;
  likes?: Record<string, boolean>;
  mentions?: string[];
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
  images?: string[]; // novo – várias imagens em Base64
  imageBase64?: string | null; // legado (primeira imagem)
  base64?: string | null;      // legado
}

interface BlockedUser {
  id: string;
  username: string;
}
interface User {
  uid: string;
  user: string;
  email: string;
  username: string;
  blockedUsers: BlockedUser[];
  // Campo que indica tipo de conta ("N" = conta gratuita)
  conta?: string;
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
  images: string[];
  imageBase64?: string | null; // legado
  timestamp: number;
  ad?: boolean;
  adLinks?: string[];
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

interface MentionSuggestion {
  id: string;
  username: string;
  user: string;
  conta: string;
}

const CACHE_KEY = 'cached_images';
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 dias em milissegundos

// Chave local para armazenar visualizações de anúncios por usuário
const AD_VIEWS_KEY = 'ad_views';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;
const screenWidth = Dimensions.get('screen').width;
const screenHeight = Dimensions.get('screen').height;

const imageSize = Math.min(windowWidth, windowHeight * 0.8);
const postWidth = windowWidth - 32; // 16px de padding em cada lado
const posheight = windowHeight / 4;
const aspectRatio = 1; // Proporção quadrada

const MAX_COMMENT_CHARS = 120;

// Máximo permitido pelo Firestore para documentos é 1MB (1.048.576 bytes).
const MAX_FIRESTORE_DOC_BYTES = 1048576;

/**
 * Comprime a imagem até que o tamanho em bytes do Base64 esteja abaixo do limite especificado.
 * A cada iteração reduz a qualidade e a largura em ~10 %.
 * Retorna a string Base64 resultante.
 */
const compressImageToLimit = async (
  uri: string,
  maxBytes: number = MAX_FIRESTORE_DOC_BYTES,
  minQuality: number = 0.2
): Promise<string> => {
  // Função auxiliar para estimar bytes a partir do Base64 (aprox. 4/3 de expansão)
  const base64ToBytes = (b64: string) => Math.round((b64.length * 3) / 4);

  let quality = 0.8; // ponto de partida
  let resizeWidth = 1000; // redimensionamento inicial

  // Primeira tentativa (evita compressão desnecessária caso já esteja pequena)
  let result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: resizeWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  // Loop enquanto a imagem continuar maior que o permitido e ainda podemos reduzir qualidade
  while (
    result.base64 &&
    base64ToBytes(result.base64) > maxBytes &&
    quality > minQuality
  ) {
    quality = Math.max(quality - 0.1, minQuality);
    resizeWidth = Math.floor(resizeWidth * 0.9);

    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: resizeWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
  }

  if (!result.base64) {
    throw new Error('Falha ao converter imagem em Base64');
  }

  return result.base64;
};

const CommentWithReadMore = ({ comment, themeColors, onLike, isLiked, likesCount, disabled }: { 
  comment: Comment, 
  themeColors: any,
  onLike: () => void,
  isLiked: boolean,
  likesCount: number,
  disabled?: boolean
}) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = comment.text && comment.text.length > MAX_COMMENT_CHARS;
  const displayText = expanded || !isLong ? comment.text : comment.text.slice(0, MAX_COMMENT_CHARS);

  return (
    <View style={{ marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8 }}>
      <Text style={{ color: themeColors.tint, fontWeight: 'bold' }}>
        {comment.username || 'Usuário'}
      </Text>
      <Text style={{ color: themeColors.googleButton }}>
        {displayText}
        {isLong && !expanded && (
          <Text
            style={{ color: themeColors.tint, fontWeight: 'bold' }}
            onPress={() => setExpanded(true)}
          > ...ver mais</Text>
        )}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={onLike} disabled={disabled} style={{ marginRight: 4 }}>
            <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={isLiked ? themeColors.tint : themeColors.googleButton} />
          </TouchableOpacity>
          <Text style={{ color: themeColors.googleButton, fontSize: 13 }}>{likesCount}</Text>
        </View>
        <Text style={{ color: themeColors.googleButton, fontSize: 12, opacity: 0.6 }}>
          {new Date(comment.timestamp).toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const FastShiiiScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  // alias para evitar lint de uso de styles antes da declaração
  const st = styles;

  const [posts, setPosts] = useState<Post[]>([]);
  const [postInputText, setPostInputText] = useState(''); // Input para criar post
  const [commentInputTexts, setCommentInputTexts] = useState<Record<string, string>>({}); // Inputs para comentários
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [createPostModalVisible, setCreatePostModalVisible] = useState(false);
  const [viewPostModalVisible, setViewPostModalVisible] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]); // múltiplas imagens
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [switchValue1, setSwitchValue1] = useState(true);
  const [switchValue2, setSwitchValue2] = useState(true);
  const [switchValue3, setSwitchValue3] = useState(true);
  const [choiceChipsValue, setChoiceChipsValue] = useState<'Populares' | 'Recentes'>('Populares');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  // Plano:
  // - 'N' e 'A': recursos restritos
  // - 'C' e 'M': plano melhorado
  const isRestricted = user?.conta === 'N' || user?.conta === 'A';
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [blockedUsersModalVisible, setBlockedUsersModalVisible] = useState(false);
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    lastVisible: null,
    hasMore: true,
    pageSize: Math.floor(Math.random() * (50 - 15 + 1)) + 15
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [blockConfirmModalVisible, setBlockConfirmModalVisible] = useState(false);
  const [blockUsername, setBlockUsername] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: {
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[];
  }>({ visible: false, title: '', message: '', buttons: [] });
  const [allUsers, setAllUsers] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const postListenersRef = useRef<Record<string, () => void>>({});
  const [showFabHint, setShowFabHint] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<FormattedPost[]>([]);
  const [postImageIndices, setPostImageIndices] = useState<Record<string, number>>({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mainIdx, setMainIdx] = useState(0);
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([]);
  const [previewVisibleFeed, setPreviewVisibleFeed] = useState(false);
  const [adViews, setAdViews] = useState<Record<string, { date: string; count: number }>>({});
  // guard to avoid multiple increments inside same fetch pass
  const adViewsBatchSet = useRef<Set<string>>(new Set());

  // Carregar visualizações de anúncios do AsyncStorage
  useEffect(() => {
    const loadAdViews = async () => {
      try {
        const data = await AsyncStorage.getItem(AD_VIEWS_KEY);
        if (data) {
          setAdViews(JSON.parse(data));
        }
      } catch (err) {
        console.error('Erro ao carregar ad views', err);
      }
    };
    loadAdViews();
  }, []);

  const saveAdViews = async (updated: Record<string, { date: string; count: number }>) => {
    try {
      setAdViews(updated);
      await AsyncStorage.setItem(AD_VIEWS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Erro ao salvar ad views', err);
    }
  };

  // Incrementa visualizações de anúncio garantindo que o usuário esteja definido
  const incrementAdView = (postId: string, currentUser: User | null = user) => {
    // Caso o usuário ainda não tenha sido definido (ex.: durante o carregamento inicial)
    if (!currentUser) return;
    const today = new Date().toISOString().slice(0, 10);
    setAdViews(prev => {
      const record = prev[postId];
      let newCount = 1;
      if (record && record.date === today) {
        newCount = record.count + 1;
      }
      const updated = { ...prev, [postId]: { date: today, count: newCount } };
      // persist async
      saveAdViews(updated);
      return updated;
    });

    // Atualizar contadores globais no Firestore (total e por dia)
    const postRef = doc(firestore, 'posts', postId);
    const dailyField = `viewsByDate.${today}`;
    updateDoc(postRef, {
      viewsTotal: increment(1),
      [dailyField]: increment(1),
    }).catch(err => console.warn('Falha ao incrementar views:', err));

    // Registrar visualização por usuário/dia em coleção dedicada
    const viewDocId = `${postId}_${currentUser.uid}_${today}`;
    const viewDocRef = doc(firestore, 'ad_views', viewDocId);
    setDoc(viewDocRef, {
      postId,
      userId: currentUser.uid,
      date: today,
      count: increment(1)
    }, { merge: true }).catch(err => console.warn('Falha ao salvar ad_views usuário:', err));
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // Definir ordenação padrão: contas gratuitas SEM ordenação popular, usar "Recentes"
          await preloadImages();
          await fetchPostsWithPagination(true, parsedUser?.conta === 'N' ? 'Recentes' : choiceChipsValue);
          return; // evitar segunda chamada abaixo
        } else {
          console.error('Nenhum usuário encontrado no AsyncStorage.');
          router.replace('/login');
          return;
        }
      } catch (error) {
        console.error('Erro ao inicializar app:', error);
      }
    };

    initializeApp();
  }, []);

  const handleLogout = async () => {
    setCustomAlert({
      visible: true,
      title: 'Sair da conta',
      message: 'Tem certeza que deseja sair?',
      buttons: [
        { text: 'Cancelar', style: 'cancel', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) },
        { text: 'Sair', style: 'destructive', onPress: () => {
          AsyncStorage.removeItem('user');
          AsyncStorage.removeItem('ad_views');
          AsyncStorage.removeItem('cache');
          router.replace('/login');
        } },
      ]
    });
  };

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // Contas gratuitas não podem selecionar várias imagens
      allowsMultipleSelection: !isRestricted,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      const newUris = result.assets.map(a => a.uri);

      if (isRestricted) {
        if (selectedImageUris.length >= 1) {
          // Já existe uma imagem escolhida – impedir seleção de mais
          setCustomAlert({
            visible: true,
            title: 'Limite atingido',
            message: 'Contas gratuitas podem adicionar apenas uma imagem por postagem.',
            buttons: [
              { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) },
            ],
          });
          return;
        }
        // Garantir apenas uma imagem
        setSelectedImageUris([newUris[0]]);
      } else {
        setSelectedImageUris(prev => [...prev, ...newUris]);
      }
    }
  };

  const handleTakePhoto = async () => {
    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        setCustomAlert({
          visible: true,
          title: 'Permissão Negada',
          message: 'Você precisa conceder permissão para usar a câmera.',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
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
      // Aplicar restrição de uma única imagem para contas gratuitas
      if (isRestricted && selectedImageUris.length >= 1) {
        setCustomAlert({
          visible: true,
          title: 'Limite atingido',
          message: 'Contas gratuitas podem adicionar apenas uma imagem por postagem.',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        setCameraModalVisible(false);
        return;
      }
      setSelectedImageUris(prev => [...prev, photo.uri]);
      setCameraModalVisible(false);
        }
      } catch (error) {
        console.error('Erro ao capturar foto:', error);
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Não foi possível capturar a foto.',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
      }
    }
  };

  const handleAddPost = async () => {
    if (!user) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Usuário não autenticado.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    if (!postInputText.trim() && !selectedImageUris.length) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Por favor, insira algum texto ou carregue uma imagem.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    // Impedir mais de uma imagem para contas gratuitas
    if (isRestricted && selectedImageUris.length > 1) {
      setCustomAlert({
        visible: true,
        title: 'Limite de Imagens',
        message: 'Sua conta permite apenas uma imagem por postagem.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) },
        ],
      });
      return;
    }

    setPosting(true);

    try {
      const imagesBase64: string[] = [];
      const perImageMax = Math.floor(MAX_FIRESTORE_DOC_BYTES / Math.max(selectedImageUris.length, 1)) - 20000; // folga
      for (const uri of selectedImageUris) {
        try {
          const b64 = await compressImageToLimit(uri, perImageMax);
          imagesBase64.push(b64);
        } catch (err) {
          console.error('Erro ao comprimir imagem:', err);
        }
      }

      const firstImage = imagesBase64.length > 0 ? imagesBase64[0] : null;

      const postData: Omit<Post, 'id'> = {
        userId: user.uid,
        username: user.username,
        content: postInputText || '',
        text: postInputText || '',
        timestamp: Date.now(),
        likes: {},
        comments: {},
        images: imagesBase64,
        imageBase64: firstImage,
        base64: firstImage,
      };

      const postDocRef = await addDoc(collection(firestore, 'posts'), postData);
      console.log('Postagem salva com ID:', postDocRef.id);

      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: 'Postagem adicionada com sucesso!',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      setPostInputText('');
      setSelectedImageUris([]);
      setCreatePostModalVisible(false);
    } catch (error: any) {
      console.error('Erro ao adicionar postagem:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao adicionar postagem: ' + error.message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
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

  const fetchPostsWithPagination = async (
    isInitialLoad: boolean = false,
    orderChoice: 'Populares' | 'Recentes' = choiceChipsValue,
    adViewsMap: Record<string, { date: string; count: number }> = adViews
  ) => {
    if (!isInitialLoad && (!pagination.hasMore || isLoadingMore)) return;
    setIsLoadingMore(true);
    const user = await AsyncStorage.getItem('user');
    const userData = JSON.parse(user || '{}');
    setUser(userData as User)
    const isRestrictedLocal = userData?.conta === 'N' || userData?.conta === 'A';
    const disableAds = userData?.conta === 'A' || userData?.conta === 'C';
    console.log(userData?.blockedUsers)
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
          images: post.images || [],
          imageBase64: post.imageBase64,
          timestamp: post.timestamp,
          ad: (post as any).ad || false,
          adLinks: (post as any).adLinks || [],
          dailyLimit: (post as any).dailyLimit || 5,
          adEndDate: (post as any).adEndDate || null,
          adStartDate: (post as any).adStartDate || null,
          visualizacoes_max_diarias: (post as any).visualizacoes_max_diarias || 30,
          viewsTotal: (post as any).viewsTotal || 0,
          viewsByDate: (post as any).viewsByDate || {},
          adContractId: (post as any).adContractId || null,
        } as FormattedPost;
      }); 

      let filteredPosts = formattedPosts;

      // Remover anúncios se conta não deve exibir
      if (disableAds) {
        const removedAds = filteredPosts.filter(p => (p as any).ad);
        if (removedAds.length > 0) {
          removedAds.forEach(ad => {
            console.log(`[REMOVIDO] Anúncio removido por disableAds: id=${ad.id}`);
          });
        }
        filteredPosts = filteredPosts.filter(p => !(p as any).ad);
      }

      const blockedUsers = Array.isArray(userData?.blockedUsers)
        ? userData.blockedUsers.map((user: BlockedUser) => user.id)
        : [];
      if (blockedUsers.length > 0) {
        console.log( "blockedUsers", blockedUsers);
        const removedByBlock = filteredPosts.filter((post: FormattedPost) => blockedUsers.includes(post.userId));
        if (removedByBlock.length > 0) {
          removedByBlock.forEach(post => {
            console.log(`[REMOVIDO] Post removido por usuário bloqueado: id=${post.id}, userId=${post.userId}`);
          });
        }
        filteredPosts = filteredPosts.filter((post: FormattedPost) => !blockedUsers.includes(post.userId));
      }
      
      // Processar ordem dos posts
      let processedPosts: FormattedPost[];
      if (isRestrictedLocal) {
        // Contas gratuitas: ordem aleatória
        processedPosts = [...filteredPosts].sort(() => Math.random() - 0.5);
      } else {
        // Premium: populares ou recentes
        processedPosts = orderChoice === 'Populares'
          ? filteredPosts.sort((a, b) => {
              const aScore = (Object.keys(a.likes).length + Object.keys(a.comments).length) / 2;
              const bScore = (Object.keys(b.likes).length + Object.keys(b.comments).length) / 2;
              return bScore - aScore;
            })
          : filteredPosts.sort((a, b) => b.timestamp - a.timestamp);
      }

      // ================= Limite diário por anúncio =================
      const today = new Date().toISOString().slice(0, 10);

      processedPosts = processedPosts.filter(p => {
        if (!(p as any).ad) return true;
        const limite_diario = (p as any).visualizacoes_max_diarias || 30;
        let endDateObj = parseToDate((p as any).adEndDate);
        console.log("endDateObj", endDateObj, today , p.id);
        if (endDateObj && endDateObj < new Date(today)) {
          console.log(`[REMOVIDO] Anúncio id=${p.id} removido por data de término expirada (endDateObj=${endDateObj}, hoje=${today})`);
          updateDoc(doc(firestore, 'posts', p.id), {
            ad: false,
          });
          updateDoc(doc(firestore , 'advertising_contracts' , (p as any).adContractId), {
            status: 'expired',
          });
          return false;
        }
        // Limite diário individual por anúncio (padrão 5)
        const adLimit = (p as any).dailyLimit || 5;
        const viewsTotal = (p as any).viewsTotal || 0;
        const viewRec = adViewsMap[p.id];
        if (viewRec && viewRec.date === today && viewRec.count >= adLimit || viewsTotal >= limite_diario) {
          console.log(`[REMOVIDO] Anúncio id=${p.id} removido por atingir limite diário (viewsTotal=${viewsTotal}, limite_diario=${limite_diario}, adLimit=${adLimit}, viewRec=${JSON.stringify(viewRec)})`);
          return false; // já atingiu o limite diário deste anúncio
        }

        // Verificar validade do anúncio
        const now = Date.now();
        const startDateObj = parseToDate((p as any).adStartDate);
        endDateObj = parseToDate((p as any).adEndDate);
        const startOk = !(p as any).adStartDate || now >= startDateObj?.getTime() || true;
        const endOk = !(p as any).adEndDate || now <= endDateObj?.getTime() || true;
        console.log("startOk", startOk, "endOk", endOk, "startDateObj", startDateObj, "endDateObj", endDateObj, "now", now, "p.id", p.id);
        if (!startOk || !endOk) {
          console.log(`[REMOVIDO] Anúncio id=${p.id} removido por fora do período de validade (startOk=${startOk}, endOk=${endOk})`);
        }
        return startOk && endOk;
      });

      // Reordenar para priorizar anúncios
      const adPosts = processedPosts.filter(p=> (p as any).ad);

      // ordenar ads com menor contagem hoje primeiro
      adPosts.sort((a,b)=>{
        const aCount = adViewsMap[a.id]?.date===today? adViewsMap[a.id].count:0;
        const bCount = adViewsMap[b.id]?.date===today? adViewsMap[b.id].count:0;
        return aCount - bCount;
      });

      // Manter apenas um anúncio nesta página (se existir)
      let selectedAds: FormattedPost[] = adPosts.slice(0,5);

      // Caso a página não traga nenhum novo anúncio, tentar reaproveitar um anúncio já existente no feed
      if (selectedAds.length === 0) {
        const existingEligibleAd = (posts as unknown as FormattedPost[])
          .filter(p => (p as any).ad)
          .find(p => {
            const adLimit = (p as any).dailyLimit || 5;
            const rec = adViewsMap[p.id];
            return !(rec && rec.date === today && rec.count >= adLimit);
          });

        if (existingEligibleAd) {
          selectedAds = [{ ...existingEligibleAd }];
        }
      }
      console.log('userData', user);
      console.log("selectedAds", selectedAds.length);
      processedPosts = [...selectedAds, ...processedPosts.filter(p=> !(p as any).ad)];

      // Registrar visualização de cada anúncio que ainda não bateu seu limite diário
      processedPosts.forEach(p => {
        if ((p as any).ad) {
          
          const adLimit = (p as any).dailyLimit || 5;
          const viewRec = adViewsMap[p.id];
          if (!viewRec || viewRec.date !== today || viewRec.count < adLimit) {
            incrementAdView(p.id, userData as User);
          }
        }
      });

      if (isInitialLoad) {
        setPosts(processedPosts as unknown as Post[]);
      } else {
        for (const post of processedPosts) {
          console.log("post", post.ad? "ad" : "normal", post.id);
        }
        console.log("adicionando posts");
        setPosts(prev => {
          // Evitar duplicatas apenas para posts normais; anúncios podem se repetir
          const existingNormalIds = new Set(prev.filter(prv => !(prv as any).ad).map(prv => prv.id));
          const toAdd = processedPosts.filter(p => {
            if ((p as any).ad) return true; // permitir repetição de anúncios
            return !existingNormalIds.has(p.id);
          });
          
          return [...prev, ...toAdd] as unknown as Post[];
        });
      }

      // Carregar imagens em background
      const imageIds = newPosts
        .flatMap(post => (post.images && post.images.length ? post.images : post.imageBase64 ? [post.imageBase64] : []));

      if (imageIds.length > 0) {
        fetchImagesWithCache().then(cachedImages => {
          const missingImages = imageIds.filter(id => 
            !cachedImages.some((img: CachedImage) => img.id === id)
          );

          if (missingImages.length > 0) {
            fetchImages().then(images => {
              missingImages.forEach(id => {
                const image = images.find((img: any) => img.id === id);
                if (image && (image as any).base64) {
                  cacheImage(id, (image as any).base64);
                }
              });
            });
          }
        });
      }

      // adicionar listeners em tempo real
      addRealtimeListeners(processedPosts);
      setRefreshing(false);
    } catch (error) {
      console.error('Erro ao buscar posts:', error);
    } finally {
      setRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const handleRefresh  = async () => {
    setRefreshing(true);
      try {
        const users = await fetchUsers();
      await fetchPostsWithPagination(true, choiceChipsValue, adViews);
    } catch (error) {
      console.error('Erro ao recarregar os posts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChipSelection = async (value: 'Populares' | 'Recentes') => {
    setChoiceChipsValue(value);
    setLoading(true);
    try {
      setPagination({ lastVisible: null, hasMore: true, pageSize: pagination.pageSize });
      await fetchPostsWithPagination(true, value, adViews);
    } catch (error) {
      console.error('Erro ao mudar ordenação:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Você precisa estar autenticado para curtir um post.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
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
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível curtir o post.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }
  };

  const handleCommentPost = async (postId: string) => {
    const commentText = commentInputTexts[postId] || '';
    
    if (!user) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Você precisa estar autenticado para comentar em um post.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    if (!commentText.trim()) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'O comentário não pode estar vazio.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    try {
      const postRef = doc(firestore, 'posts', postId);
      const commentId = `${user.uid}_${Date.now()}`;

      await updateDoc(postRef, {
        [`comments.${commentId}`]: {
          userId: user.uid,
          username: user.username,
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
                    username: user.username,
                    text: commentText,
                    timestamp: Date.now(),
                  },
                },
              }
            : post
        )
      );

      // Limpar o input após o comentário
      setCommentInputTexts(prev => ({
        ...prev,
        [postId]: ''
      }));
    } catch (error) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível adicionar o comentário.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }
  };

  const handleMorePress = (username: string) => {
    setSelectedUser(username);
    setMoreOptionsVisible(true);
  };

  const handleBlockUser = () => {
    setBlockConfirmModalVisible(true);
  };
  
  const handleConfirmBlock = (username: string) => {
    fetchPostsWithPagination(true);
    setCustomAlert({
      visible: true,
      title: 'Usuário Bloqueado',
      message: `Você bloqueou o usuário ${username}.`,
      buttons: [
        {
          text: 'OK',
          style: 'default',
          onPress: () => {
            setMoreOptionsVisible(false);
            setCustomAlert(prev => ({ ...prev, visible: false }));
          }
        }
      ]
    });
  };

  const handleUsernamePress = (username: string, userId: string) => {
    setSelectedUser(username);
    console.log(userId);
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  // Componente de item de post para evitar hooks em função render
  const PostItem: React.FC<{ item: FormattedPost }> = ({ item }) => {
    const isLiked = user?.uid ? !!item.likes[user.uid] : false;
    const likeCount = Object.keys(item.likes || {}).filter((key) => item.likes[key]).length;
    const commentCount = Object.keys(item.comments || {}).length;

    return renderPostContent(item, isLiked, likeCount, commentCount);
  };

  // Função separada para renderizar UI do post (sem hooks)
  const renderPostContent = (item: FormattedPost, isLiked: boolean, likeCount: number, commentCount: number) => {
    const st = styles;
    return (
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: '/SubTelas/post_details',
            params: { postId: item.id }
          });
        }}
      >
        <View style={[st.postContainer, { backgroundColor: themeColors.background }]}>
          <View style={st.postHeader}>
            <TouchableOpacity onPress={() => handleUsernamePress(item.username, item.userId)}>
              <Text style={[st.postUsername, { color: themeColors.tint }]}>{item.username}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.iconButton_trez, { borderColor: themeColors.googleButton }]}
              onPress={() => handleMorePress(item.username)}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={themeColors.googleButton} />
            </TouchableOpacity>
          </View>
          {item.images && item.images.length > 0 ? (
            (() => {
              const currentIdx = postImageIndices[item.id] ?? 0;
              const total = item.images.length;
              return (
                <View style={st.imageContainer}>
                  <Image source={{ uri: `data:image/jpeg;base64,${item.images[currentIdx]}` }} style={st.postImage} resizeMode="cover" />
                  {total > 1 && (
                    <>
                      <TouchableOpacity
                        style={st.arrowLeft}
                        onPress={() => setPostImageIndices(prev => ({ ...prev, [item.id]: (currentIdx - 1 + total) % total }))}
                      >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={st.arrowRight}
                        onPress={() => setPostImageIndices(prev => ({ ...prev, [item.id]: (currentIdx + 1) % total }))}
                      >
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                      </TouchableOpacity>
                      <View style={st.counterOverlaySmall}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>{currentIdx + 1}/{total}</Text>
                      </View>
                    </>
                  )}
                </View>
              );
            })()
          ) : item.imageBase64 ? (
            <View style={st.imageContainer}>
              <Image source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }} style={st.postImage} resizeMode="cover" />
            </View>
          ) : null}
          <Text style={[st.postContent, { color: themeColors.googleButton }]}>{item.content}</Text>

          {item.ad && (
            <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: themeColors.tint, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>Anúncio</Text>
              {item.adLinks && item.adLinks.length > 0 && (
                <View style={{ marginTop:6 }}>
                  {item.adLinks.map((lnk, idx) => (
                    <TouchableOpacity key={idx} onPress={() => Linking.openURL(lnk)} style={{ flexDirection:'row', alignItems:'center', marginBottom:4 }}>
                      <Ionicons name="link" size={16} color="#fff" />
                      <Text
                        style={{ color:'#fff', marginLeft:6, textDecorationLine:'underline' }}
                        numberOfLines={1}
                      >
                        {lnk.replace(/https?:\/\//,'')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          <View style={st.postFooter}>
            <View style={st.postActions}>
              <TouchableOpacity
                style={[
                  st.iconButton,
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
              <Text style={[st.postActionText, { color: themeColors.googleButton }]}>
                {likeCount}
              </Text>
              <TouchableOpacity
                style={[st.iconButton, { borderColor: themeColors.googleButton }]}
                onPress={() => setExpandedPostId(expandedPostId === item.id ? null : item.id)}
              >
                <Ionicons name="chatbubble-outline" size={20} color={themeColors.googleButton} />
              </TouchableOpacity>
              <Text style={[st.postActionText, { color: themeColors.googleButton }]}>
                {commentCount}
              </Text>
            </View>
          </View>
          {/* Comentários expandido */}
          {expandedPostId === item.id && (
            <View style={{ marginTop: 12, maxHeight: windowHeight * 0.8, borderRadius: 8, padding: 8, backgroundColor: 'rgba(0,0,0,0.03)' }}>
              <ScrollView style={{ flexGrow: 0 }}>
                {Object.values(item.comments || {}).length === 0 ? (
                  <Text style={{ color: themeColors.googleButton, opacity: 0.7 }}>Nenhum comentário ainda.</Text>
                ) : (
                  Object.values(item.comments || {})
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((comment: Comment, idx) => (
                      <CommentWithReadMore 
                        key={idx} 
                        comment={comment} 
                        themeColors={themeColors}
                        onLike={() => handleLikeComment(item.id, comment)}
                        isLiked={!!comment.likes && !!user && !!comment.likes[user.uid]}
                        likesCount={comment.likes ? Object.values(comment.likes).filter(Boolean).length : 0}
                        disabled={likingComment === Object.keys(item.comments).find(key => 
                          item.comments[key].timestamp === comment.timestamp && 
                          item.comments[key].userId === comment.userId
                        )}
                      />
                    ))
                )}
              </ScrollView>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <View style={{ flex: 1, position: 'relative' }}>
                  <TextInput
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      color: themeColors.googleButton,
                      borderRadius: 8,
                      padding: 8,
                      marginRight: 8,
                    }}
                    placeholder="Escreva um comentário..."
                    placeholderTextColor={themeColors.textSearch}
                    value={commentInputTexts[item.id] || ''}
                    onChangeText={(text) => handleCommentTextChange(item.id, text)}
                  />
                  {renderMentionSuggestions()}
                </View>
                <TouchableOpacity
                  onPress={() => handleCommentPost(item.id)}
                  style={{
                    backgroundColor: themeColors.tint,
                    borderRadius: 8,
                    padding: 8,
                  }}
                  disabled={!commentInputTexts[item.id]?.trim()}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setExpandedPostId(null)}
                  style={{
                    marginLeft: 8,
                    padding: 8,
                  }}
                >
                  <Ionicons name="close" size={20} color={themeColors.googleButton} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const Chip: React.FC<ChipProps> = ({ label, selected, onPress }) => (
    <TouchableOpacity
      style={[st.chip, selected ? {backgroundColor: themeColors.tint } : st.chipUnselected]}
      onPress={onPress}
    >
      <Text style={selected ? st.chipTextSelected : st.chipTextUnselected}>
        {label}
      </Text>
    </TouchableOpacity>
  );

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
    console.log("carregando mais");
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
          if ((image as any).base64) {
            await cacheImage((image as any).id, (image as any).base64);
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
      setUser(prev => ({ ...(prev as User), blockedUsers: blockedUsersInfo as BlockedUser[] } as User));
      
      // Atualizar o AsyncStorage com os dados mais recentes
      const updatedUserData = {
        ...currentUser,
        blockedUsers: blockedUsersInfo
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
            const updatedBlockedUsers = (currentUser.blockedUsers || []).filter((id: BlockedUser) => id.id !== userId);
            const updatedUserData = {
              ...currentUser,
              blockedUsers: updatedBlockedUsers
            };
            await AsyncStorage.setItem('user', JSON.stringify(updatedUserData));
            // Atualizar o estado local
            setUser(prev => ({
              ...(prev as User),
              blockedUsers: (prev?.blockedUsers || []).filter((user: BlockedUser) => user.id !== userId)
            } as User));
            setCustomAlert({
              visible: true,
              title: 'Sucesso',
              message: `Usuário ${username} foi desbloqueado com sucesso.`,
              buttons: [
                { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
              ]
            });
            fetchPostsWithPagination(true);
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

  // Carregar todos os usuários
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersRef = collection(firestore, 'usuarios');
        const querySnapshot = await getDocs(usersRef);
        const users = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username || '',
            user: data.user || '',
            conta: data.conta || 'N'
          } as MentionSuggestion;
        });
        setAllUsers(users);
        for (const useraq of users) {
          if (useraq.id === user?.uid) {
            setUser(prev => ({ ...prev, conta: useraq.conta }));
            await AsyncStorage.setItem('user', JSON.stringify({ ...user, conta: useraq.conta }));
            break;
        }}
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsers();
  }, []);

  // Buscar sugestões de menção
  const fetchMentionSuggestions = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setMentionSuggestions([]);
      return;
    }

    const blockedUserIds = user?.blockedUsers?.map(user => user.id) || [];
    const filteredUsers = allUsers
      .filter(user => 
        !blockedUserIds.includes(user.id) && 
        user.user.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5);

    setMentionSuggestions(filteredUsers);
  };

  // Manipular mudança no texto do comentário
  const handleCommentTextChange = (postId: string, text: string) => {
    setCommentInputTexts(prev => ({
      ...prev,
      [postId]: text
    }));
    
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = text.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionStartIndex(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        fetchMentionSuggestions(textAfterAt);
        return;
      }
    }
    setShowMentions(false);
  };

  // Inserir menção no texto
  const insertMention = (postId: string, username: string) => {
    if (mentionStartIndex === -1) return;
    
    const currentText = commentInputTexts[postId] || '';
    const beforeMention = currentText.slice(0, mentionStartIndex);
    const afterMention = currentText.slice(mentionStartIndex + mentionQuery.length + 1);
    const newText = `${beforeMention}@${username} ${afterMention}`;
    
    setCommentInputTexts(prev => ({
      ...prev,
      [postId]: newText
    }));
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // Renderizar sugestões de menção
  const renderMentionSuggestions = () => {
    if (!showMentions || mentionSuggestions.length === 0) return null;

    return (
      <View style={[st.mentionSuggestions, { backgroundColor: themeColors.background }]}>
        <ScrollView style={{ maxHeight: 200 }}>
          {mentionSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={suggestion.id}
              style={[
                st.mentionSuggestionItem,
                { backgroundColor: index === selectedMentionIndex ? 'rgba(255,255,255,0.1)' : 'transparent' }
              ]}
              onPress={() => insertMention(suggestion.id, suggestion.user)}
            >
              <View style={st.mentionSuggestionContent}>
                <Image
                  source={require('@/assets/icons/aguiaa.png')}
                  style={[st.mentionAvatar, { tintColor: themeColors.googleButton }]}
                />
                <View style={st.mentionUserInfo}>
                  <Text style={[st.mentionUsername, { color: themeColors.googleButton }]}>
                    {suggestion.user}
                  </Text>
                  <Text style={[st.mentionName, { color: themeColors.googleButton }]}>
                    {suggestion.username}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const handleLikeComment = async (postId: string, comment: Comment) => {
    if (!user) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Você precisa estar autenticado para curtir um comentário.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    const commentKey = Object.keys(posts.find(p => p.id === postId)?.comments || {})
      .find(key => {
        const c = posts.find(p => p.id === postId)?.comments[key];
        return c?.timestamp === comment.timestamp && c?.userId === comment.userId;
      });

    if (!commentKey) {
      console.error('Comentário não encontrado');
      return;
    }

    setLikingComment(commentKey);
    try {
      const postRef = doc(firestore, 'posts', postId);
      const currentLikes = comment.likes || {};
      const isLiked = !!currentLikes[user.uid];
      
      if (isLiked) {
        delete currentLikes[user.uid];
      } else {
        currentLikes[user.uid] = true;
      }

      await updateDoc(postRef, {
        [`comments.${commentKey}.likes`]: currentLikes
      });

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const updatedComments = { ...post.comments };
          updatedComments[commentKey] = {
            ...updatedComments[commentKey],
            likes: currentLikes
          };
          return { ...post, comments: updatedComments };
        }
        return post;
      }));

    } catch (error) {
      console.error('Erro ao curtir/descurtir comentário:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível curtir/descurtir o comentário.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    } finally {
      setLikingComment(null);
    }
  };

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(postListenersRef.current).forEach(unsub => unsub && unsub());
    };
  }, []);

  // before fetchPostsWithPagination definition
  const addRealtimeListeners = (postsArray: FormattedPost[]) => {
    postsArray.forEach(post => {
      if (postListenersRef.current[post.id]) return;
      const unsub = onSnapshot(doc(firestore, 'posts', post.id), snapshot => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: data.likes || {}, comments: data.comments || {} } : p));
      });
      postListenersRef.current[post.id] = unsub;
    });
  };

  // Filtrar posts quando searchText mudar
  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    const queryLower = searchText.toLowerCase();
    const results = (posts as unknown as FormattedPost[]).filter(p => {
      if (p.content && p.content.toLowerCase().includes(queryLower)) return true;
      if (p.comments) {
        return Object.values(p.comments).some((c: Comment) => c.text.toLowerCase().includes(queryLower));
      }
      return false;
    });
    setSearchResults(results);
  }, [searchText, posts]);

  const handleCropMainImage = async () => {
    if (selectedImageUris.length === 0) return;
    const currentUri = selectedImageUris[mainIdx];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled) {
      const newUri = result.assets[0].uri;
      setSelectedImageUris(prev => prev.map((u,i)=> i===mainIdx? newUri:u));
    }
  };

  const handleDeleteMainImage = () => {
    if (selectedImageUris.length === 0) return;
    setSelectedImageUris(prev => {
      const arr = prev.filter((_,i)=> i!==mainIdx);
      if (mainIdx >= arr.length) setMainIdx(Math.max(arr.length-1,0));
      return arr;
    });
  };

  // Render wrapper para FlatList
  const renderPost = ({ item }: { item: FormattedPost }) => <PostItem item={item} />;

  // Sincronizar ad_views remotos após usuário ser carregado
  useEffect(() => {
    if (!user?.uid) return;

    const syncAdViews = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const q = query(
          collection(firestore, 'ad_views'),
          where('userId', '==', user.uid),
          where('date', '==', today)
        );
        const snapshot = await getDocs(q);

        const serverViews: Record<string, { date: string; count: number }> = {};
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as any;
          serverViews[data.postId] = { date: data.date, count: data.count || 0 };
        });

        // Merge com local, pegando o maior contador
        const merged: Record<string, { date: string; count: number }> = { ...adViews };
        const allIds = new Set([...Object.keys(adViews), ...Object.keys(serverViews)]);
        for (const id of allIds) {
          const localRec = adViews[id];
          const serverRec = serverViews[id];
          if (localRec && localRec.date === today && serverRec) {
            merged[id] = { date: today, count: Math.max(localRec.count, serverRec.count) };
          } else if (serverRec) {
            merged[id] = serverRec;
          }
        }

        // Atualizar AsyncStorage & state
        await AsyncStorage.setItem(AD_VIEWS_KEY, JSON.stringify(merged));
        setAdViews(merged);

        // Se algum contador local era maior que o do servidor, atualizar Firestore
        for (const [postId, rec] of Object.entries(merged)) {
          const serverCount = serverViews[postId]?.count || 0;
          if (rec.date === today && rec.count > serverCount) {
            const viewDocRef = doc(firestore, 'ad_views', `${postId}_${user.uid}_${today}`);
            await setDoc(viewDocRef, { count: rec.count }, { merge: true });
          }
        }
      } catch (err) {
        console.warn('Falha ao sincronizar ad_views:', err);
      }
    };

    syncAdViews();
    // run once per user load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

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

      <Modal visible={previewVisibleFeed} transparent={true} animationType="fade">
                  <ImageViewer
                    imageUrls={(selectedImageUris || []).map(img => ({ url: img }))}
                    index={mainIdx}
                    enableSwipeDown={true}
                    onSwipeDown={() => setPreviewVisibleFeed(false)}
                    onClick={() => setPreviewVisibleFeed(false)}
                    renderHeader={() => (
                      <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewVisibleFeed(false)}>
                        <Ionicons name="close" size={30} color="#fff" />
                      </TouchableOpacity>
                    )}
                  />
                </Modal>
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
            {/* Barra de ações: pesquisa e novo post */}
            <View style={styles.actionBar}>
              {/* Pesquisa desabilitada para contas gratuitas */}
              {!isRestricted && (
                <TouchableOpacity
                  style={[styles.searchButton, { backgroundColor: themeColors.icon }]}
                  onPress={() => setSearchModalVisible(true)}
                >
                  <Ionicons name="search" size={24} color={themeColors.googleButton} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.fabButton,
                  {
                    backgroundColor: themeColors.tint,
                    width: showFabHint ? windowWidth - 100 : 56,
                    paddingHorizontal: showFabHint ? 16 : 0,
                  },
                ]}
                onPress={() => setCreatePostModalVisible(true)}
                onLongPress={() => setShowFabHint(true)}
                onPressOut={() => setShowFabHint(false)}
                delayLongPress={400}
              >
                {showFabHint ? (
                  <Text style={styles.fabHintText}>Compartilhe seus pensamentos...</Text>
                ) : (
                  <Ionicons name="add" size={28} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Choice Chips */}
            {/* Chips escondidos para contas gratuitas */}
            {!isRestricted && (
              <View style={[styles.chipsContainer, { marginTop: showFabHint ? '10%' : 0 }]}>
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
            )}

            {/* Lista de Posts */}
          {loading ? (
            <ActivityIndicator size="large" color={themeColors.tint} style={styles.loadingIndicator} />
          ) : (
            <FlatList
              data={posts as unknown as FormattedPost[]}
              keyExtractor={(item, index) => item.id ? String(item.id) + '_' + index : String(index)}
              renderItem={renderPost}
              contentContainerStyle={styles.postsList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.2}
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
            //onPress={() => setCreatePostModalVisible(false)}
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
                value={postInputText}
                onChangeText={setPostInputText}
                placeholder="Escreva algo..."
                placeholderTextColor={'rgba(255,255,255,0.5)'}
              />
              {selectedImageUris.length > 0 && (
                <>
                  {/* Main Preview */}
                  <View style={st.mainPreviewWrapper}>
                    <TouchableOpacity activeOpacity={0.9} onPress={()=>{setPreviewIndex(mainIdx); setPreviewVisibleFeed(true);}} onLongPress={handleCropMainImage}>
                      <Image source={{uri: selectedImageUris[mainIdx]}} style={st.mainPreviewImage} />
                    </TouchableOpacity>
                    {selectedImageUris.length>1 && (
                      <>
                        <TouchableOpacity style={st.arrowLeftLarge} onPress={()=> setMainIdx((mainIdx-1+selectedImageUris.length)%selectedImageUris.length)}>
                          <Ionicons name="chevron-back" size={30} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={st.arrowRightLarge} onPress={()=> setMainIdx((mainIdx+1)%selectedImageUris.length)}>
                          <Ionicons name="chevron-forward" size={30} color="#fff" />
                        </TouchableOpacity>
                      </>
                    )}
                    {/* delete */}
                    <TouchableOpacity style={st.removeMainBtn} onPress={handleDeleteMainImage}>
                      <Ionicons name="trash" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {/* Thumbnails */}
                 <ScrollView horizontal style={{marginVertical:10}} showsHorizontalScrollIndicator={false}>
                   {selectedImageUris.map((uri, idx) => (
                     <TouchableOpacity key={idx} onPress={()=> setMainIdx(idx)}>
                       <Image source={{ uri }} style={[st.dynamicImage,{marginRight:8, borderWidth: idx===mainIdx?2:0, borderColor: themeColors.tint}]} />
                     </TouchableOpacity>
                   ))}
                 </ScrollView>
                </>
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
                  {selectedPost.images && selectedPost.images.length > 0 ? (
                    (() => {
                      const currentIdx = postImageIndices[selectedPost.id] ?? 0;
                      const total = selectedPost.images.length;
                      return (
                        <View style={styles.imageContainer}>
                          <Image source={{ uri: `data:image/jpeg;base64,${selectedPost.images[currentIdx]}` }} style={styles.postImage} resizeMode="cover" />
                          {total > 1 && (
                            <>
                              <TouchableOpacity
                                style={st.arrowLeft}
                                onPress={() => setPostImageIndices(prev => ({ ...prev, [selectedPost.id]: (currentIdx - 1 + total) % total }))}
                              >
                                <Ionicons name="chevron-back" size={24} color="#fff" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={st.arrowRight}
                                onPress={() => setPostImageIndices(prev => ({ ...prev, [selectedPost.id]: (currentIdx + 1) % total }))}
                              >
                                <Ionicons name="chevron-forward" size={24} color="#fff" />
                              </TouchableOpacity>
                              <View style={st.counterOverlaySmall}>
                                <Text style={{ color: '#fff', fontSize: 12 }}>{currentIdx + 1}/{total}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      );
                    })()
                  ) : selectedPost.imageBase64 ? (
                    <Image source={{ uri: `data:image/jpeg;base64,${selectedPost.imageBase64}` }} style={styles.dynamicImage} resizeMode="cover" />
                  ) : null}
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
                {Array.isArray(user?.blockedUsers) && user?.blockedUsers.length > 0 ? (
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
                style={[styles.modalButton_fechar, { backgroundColor: themeColors.tint }]}
                onPress={() => setBlockedUsersModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Fechar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        {/* Modal de Confirmação de Bloqueio */}
        <BlockUserModal
          visible={blockConfirmModalVisible}
          onClose={() => setBlockConfirmModalVisible(false)}
          selectedUser={selectedUser}
          onBlockUser={handleConfirmBlock}
        />
      </LinearGradient>
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      />

      {/* Modal de Pesquisa */}
      <Modal visible={searchModalVisible} transparent={false} animationType="slide">
        <View style={[styles.searchContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.searchHeader}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: themeColors.googleButton,
                  borderRadius: 8,
                  marginRight: 8,
                },
              ]}
              placeholder="Pesquisar..."
              placeholderTextColor={themeColors.textSearch}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setSearchModalVisible(false); setSearchText(''); }}>
              <Ionicons name="close" size={28} color={themeColors.googleButton} />
            </TouchableOpacity>
          </View>

          {searchText.trim() === '' ? (
            <Text style={{ color: themeColors.googleButton, textAlign: 'center' }}>
              Digite algo para pesquisar em posts e comentários.
            </Text>
          ) : searchResults.length === 0 ? (
            <Text style={{ color: themeColors.googleButton, textAlign: 'center' }}>
              Nenhum resultado encontrado.
            </Text>
          ) : (
            <FlatList
              data={searchResults as unknown as FormattedPost[]}
              keyExtractor={(item, index) => item.id ? String(item.id) + '_' + index : String(index)}
              renderItem={renderPost}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
              )}
            />
          )}
        </View>
      </Modal>
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
    marginTop: StatusBar.currentHeight,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.73)',
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingIndicator: {
    marginVertical: 20,
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
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: Math.min(windowWidth * 0.8, 380),
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  modalButton_fechar: {
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
  },
  mentionSuggestions: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    maxHeight: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
    zIndex: 1000,
  },
  mentionSuggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  mentionSuggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  mentionUserInfo: {
    flex: 1,
  },
  mentionUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  mentionName: {
    fontSize: 12,
    opacity: 0.7,
  },
  fabWrapper: {
    width: postWidth,
    alignItems: 'flex-end',
    marginTop: 20,
    marginBottom: 16,
  },
  fabButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 8,
    flexDirection: 'row',
  },
  fabHintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBar: {
    width: postWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  searchButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 12,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    padding: 20,
  },
  arrowLeft: {
    position: 'absolute',
    top: '50%',
    left: 10,
    zIndex: 1000,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  arrowRight: {
    position: 'absolute',
    top: '50%',
    right: 10,
    zIndex: 1000,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  counterOverlaySmall: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mainPreviewWrapper: {
    width: postWidth,
    height: postWidth * aspectRatio,
    borderRadius: 10,
    overflow: 'hidden',
    position:'relative',
  },
  mainPreviewImage: {
    width: '100%',
    height: '100%',
  },
  arrowLeftLarge: {
    position:'absolute',
    top:'50%',
    left:10,
    padding:8,
    backgroundColor:'rgba(0,0,0,0.4)',
    borderRadius:20,
  },
  arrowRightLarge: {
    position:'absolute',
    top:'50%',
    right:10,
    padding:8,
    backgroundColor:'rgba(0,0,0,0.4)',
    borderRadius:20,
  },
  removeMainBtn: {
    position:'absolute',
    top:10,
    right:10,
    backgroundColor:'rgba(0,0,0,0.6)',
    borderRadius:20,
    padding:6,
  },
});

function parseToDate(date: any): Date | null {
  if (!date) return null;
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'object' && date.seconds) return new Date(date.seconds * 1000);
  return null;
}
