import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/firebaseConfig';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteField, collection, query, where, getDocs, orderBy, limit, QueryConstraint, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageViewer from 'react-native-image-zoom-viewer';
import BlockUserModal from '@/components/BlockUserModal';
import CommentItem from '@/components/CommentItem';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

interface Post {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
  likes: Record<string, boolean>;
  comments: Record<string, Comment>;
  images?: string[];
  imageBase64?: string | null;
  ad?: boolean;
  adLinks?: string[];
}

interface Comment {
  userId: string;
  text: string;
  timestamp: number;
  username?: string;
  likes?: Record<string, boolean>;
  mentions?: string[];
}

interface User {
  uid: string;
  id: string;
  user: string;
  username: string;
  email: string;
}

interface MentionSuggestion {
  id: string;
  username: string;
  user: string;
}

interface BlockedUser {
  id: string;
  username: string;
}

const MAX_COMMENT_CHARS = 120;

const CommentWithReadMore = ({ comment, themeColors, expanded, onExpand, onCollapse, onLike, isLiked, likesCount, disabled }: {
  comment: Comment,
  themeColors: any,
  expanded: boolean,
  onExpand: () => void,
  onCollapse?: () => void,
  onLike: () => void,
  isLiked: boolean,
  likesCount: number,
  disabled?: boolean
}) => {
  const isLong = comment.text && comment.text.length > MAX_COMMENT_CHARS;
  const displayText = expanded || !isLong ? comment.text : comment.text.slice(0, MAX_COMMENT_CHARS);

  const [localExpanded, setLocalExpanded] = useState(expanded);
  useEffect(() => { setLocalExpanded(expanded); }, [expanded]);

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Text style={[styles.commentUsername, { color: themeColors.tint }]}>
          {comment.username || 'Usuário'}
        </Text>
        <Text style={[styles.commentTime, { color: themeColors.googleButton }]}>
          {new Date(comment.timestamp).toLocaleString()}
        </Text>
      </View>
      <Text style={[styles.commentText, { color: themeColors.googleButton }]}
        numberOfLines={localExpanded ? undefined : 3}
        ellipsizeMode={localExpanded ? undefined : 'tail'}
      >
        {displayText}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={onLike} disabled={disabled} style={{ marginRight: 4 }}>
            <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={isLiked ? themeColors.tint : themeColors.googleButton} />
          </TouchableOpacity>
          <Text style={{ color: themeColors.googleButton, fontSize: 13 }}>{likesCount}</Text>
        </View>
        {isLong && !localExpanded && (
          <TouchableOpacity onPress={() => { setLocalExpanded(true); onExpand(); }} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
            <Text style={{ color: themeColors.tint, fontWeight: 'bold' }}>...ver mais</Text>
          </TouchableOpacity>
        )}
        {isLong && localExpanded && (
          <TouchableOpacity onPress={() => { setLocalExpanded(false); onCollapse && onCollapse(); }} style={{ alignSelf: 'flex-end', marginTop: 2 }}>
            <Text style={{ color: themeColors.tint, fontWeight: 'bold' }}>ver menos</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const PostDetailsScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { postId } = useLocalSearchParams();
  const [post, setPost] = useState<Post | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [postUser, setPostUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const insets = useSafeAreaInsets();
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [commentUsernames, setCommentUsernames] = useState<{ [userId: string]: string }>({});
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });
  const [expandedComments, setExpandedComments] = useState<{ [key: number]: boolean }>({});
  const [likingComment, setLikingComment] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedComment, setMentionedComment] = useState<Comment | null>(null);

  useEffect(() => {
    const loadData = async () => {
      console.log( "postId", postId);
      try {
        // Load current user
        const storedUser = await AsyncStorage.getItem('user');
        const userData = JSON.parse(storedUser || '{}');
        console.log( "userData", userData);
        if (userData) {
          setUser(userData);
        }
        // Load post data
        const postDoc = await getDoc(doc(firestore, 'posts', postId as string));
        if (postDoc.exists()) {
          const postData = { id: postDoc.id, ...postDoc.data() } as Post;
          setPost(postData);
          setIsLiked(postData.likes[userData?.uid || ''] || false);
          setLikesCount(Object.keys(postData.likes).filter(key => postData.likes[key]).length);
          
          // Sort comments by timestamp
          const sortedComments = Object.values(postData.comments || {})
            .sort((a, b) => b.timestamp - a.timestamp);
          setComments(sortedComments);

          // Verificar se o usuário foi mencionado
          const blockedUserIds = blockedUsers.map(user => user.id);
          const mentionedComment = sortedComments.find(comment => 
            comment.mentions?.includes(userData?.uid || '') && 
            !blockedUserIds.includes(comment.userId)
          );
          if (mentionedComment) {
            setMentionedComment(mentionedComment);
          }

          // Load post user data
          try {
            const userDoc = await getDoc(doc(firestore, 'usuarios', postData.userId));
            if (userDoc.exists()) {
              setPostUser({ id: userDoc.id, ...userDoc.data() } as User);
              
            }
          } catch (error) {
            console.error('Error loading user data:', error);
          }
          if (userData?.uid === postData?.userId) {
            setIsMe(true);
          }else{
            setIsMe(false);
          }
        }
      } catch (error) {
        console.error('Error loading post details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [postId, blockedUsers]);

  useEffect(() => {
    const fetchCommentUsernames = async () => {
      if (!comments.length) return;
      const missingUserIds = comments
        .map(c => c.userId)
        .filter(uid => !commentUsernames[uid]);
      if (missingUserIds.length === 0) return;

      const newUsernames: { [userId: string]: string } = { ...commentUsernames };
      for (const uid of missingUserIds) {
        try {
          const userDoc = await getDoc(doc(firestore, 'usuarios', uid));
          if (userDoc.exists()) {
            newUsernames[uid] = userDoc.data().user || uid;
          } else {
            newUsernames[uid] = uid;
          }
        } catch {
          newUsernames[uid] = uid;
        }
      }
      setCommentUsernames(newUsernames);
    };
    fetchCommentUsernames();
  }, [comments]);

  // Carregar todos os usuários e usuários bloqueados
  useEffect(() => {
    const loadUsersAndBlocked = async () => {
      if (!user?.uid) return;
      try {
        // Carregar usuários bloqueados
        const userDoc = await getDoc(doc(firestore, 'usuarios', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Garantir que blockedUsers seja um array de objetos BlockedUser
          const blockedUsersData = Array.isArray(userData.blockedUsers) 
            ? userData.blockedUsers 
            : [];
          setBlockedUsers(blockedUsersData);
        }

        // Carregar todos os usuários
        const usersRef = collection(firestore, 'usuarios');
        const querySnapshot = await getDocs(usersRef);
        const users = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username || '',
            user: data.user || ''
          } as MentionSuggestion;
        });
        setAllUsers(users);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsersAndBlocked();
  }, [user?.uid]);

  // Buscar sugestões de menção (agora usando a lista em memória)
  const fetchMentionSuggestions = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setMentionSuggestions([]);
      return;
    }

    const blockedUserIds = blockedUsers.map(user => user.id);
    const filteredUsers = allUsers
      .filter(user => 
        !blockedUserIds.includes(user.id) && 
        user.user.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5); // Limitar a 5 sugestões

    setMentionSuggestions(filteredUsers);
  };

  // Manipular mudança no texto do comentário
  const handleCommentTextChange = (text: string) => {
    setCommentText(text);
    
    // Verificar se há um @ sendo digitado
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
  const insertMention = (username: string) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = commentText.slice(0, mentionStartIndex);
    const afterMention = commentText.slice(mentionStartIndex + mentionQuery.length + 1);
    const newText = `${beforeMention}@${username} ${afterMention}`;
    
    setCommentText(newText);
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // Função para rolar até o comentário mencionado
  const scrollToMentionedComment = () => {
    if (mentionedComment) {
      const commentIndex = comments.findIndex(c => 
        c.timestamp === mentionedComment.timestamp && 
        c.userId === mentionedComment.userId
      );
      if (commentIndex !== -1) {
        // Rolar até o comentário
        const scrollView = document.querySelector('.scrollView');
        if (scrollView) {
          scrollView.scrollTo({
            top: commentIndex * 100, // Aproximadamente a altura de cada comentário
            behavior: 'smooth'
          });
        }
      }
    }
  };

  // Renderizar sugestões de menção
  const renderMentionSuggestions = () => {
    if (!showMentions || mentionSuggestions.length === 0) return null;

    return (
      <View style={[styles.mentionSuggestions, { backgroundColor: themeColors.background }]}>
        <ScrollView style={{ maxHeight: 200 }}>
          {mentionSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={suggestion.id}
              style={[
                styles.mentionSuggestionItem,
                { backgroundColor: index === selectedMentionIndex ? 'rgba(255,255,255,0.1)' : 'transparent' }
              ]}
              onPress={() => insertMention(suggestion.user)}
            >
              <View style={styles.mentionSuggestionContent}>
                <Image
                  source={require('@/assets/icons/aguiaa.png')}
                  style={[styles.mentionAvatar, { tintColor: themeColors.googleButton }]}
                />
                <View style={styles.mentionUserInfo}>
                  <Text style={[styles.mentionUsername, { color: themeColors.googleButton }]}>
                    {suggestion.user}
                  </Text>
                  <Text style={[styles.mentionName, { color: themeColors.googleButton }]}>
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

  const handleLike = async () => {
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
      const postRef = doc(firestore, 'posts', post?.id || '');
      const isLiked = post?.likes[user.uid];

      if (isLiked) {
        await updateDoc(postRef, {
          [`likes.${user.uid}`]: false,
        });
      } else {
        await updateDoc(postRef, {
          [`likes.${user.uid}`]: true,
        });
      }

      if (post) {
        setPost({
          ...post,
          likes: {
            ...post.likes,
            [user.uid]: !isLiked,
          },
        });
      }
      
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
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

  const handleComment = async () => {
    if (!user || !user.uid || !post || !commentText.trim()) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Usuário não autenticado ou comentário vazio.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }

    try {
      const postRef = doc(firestore, 'posts', post.id);
      const commentId = `${user.uid}_${Date.now()}`;
      const newComment = {
        userId: user.uid,
        username: user.username,
        text: commentText.trim(),
        timestamp: Date.now()
      };

      await updateDoc(postRef, {
        [`comments.${commentId}`]: newComment
      });

      setComments(prev => [newComment, ...prev]);
      setCommentText('');
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
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

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const handleMorePress = (username: string) => {
    setMoreOptionsVisible(true);
  };

  const handleBlockUser = () => {
    setMoreOptionsVisible(false);
    setBlockModalVisible(true);
  };

  const handleConfirmBlock = (username: string) => {
    console.log( "handleConfirmBlock", username);
    setCustomAlert({
      visible: true,
      title: 'Usuário Bloqueado',
      message: `Você bloqueou o usuário ${username}.`,
      buttons: [
        { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
      ]
    });
    router.back();
  };

  // Função auxiliar para obter a chave do comentário
  const getCommentKey = (comment: Comment) => {
    if (!post) return undefined;
    return Object.keys(post.comments).find(
      key => post.comments[key].timestamp === comment.timestamp && post.comments[key].userId === comment.userId
    );
  };

  const handleExpandComment = (timestamp: number) => {
    setExpandedComments(prev => ({ ...prev, [timestamp]: true }));
  };

  const handleLikeComment = async (comment: Comment) => {
    if (!user || !user.uid || !post) {
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

    const commentKey = Object.keys(post.comments).find(
      key => post.comments[key].timestamp === comment.timestamp && post.comments[key].userId === comment.userId
    );

    if (!commentKey) {
      console.error('Comentário não encontrado');
      return;
    }

    setLikingComment(commentKey);
    try {
      const postRef = doc(firestore, 'posts', post.id);
      const currentLikes = post.comments[commentKey].likes || {};
      const isLiked = !!currentLikes[user.uid];
      
      // Atualizar o Firestore
      if (isLiked) {
        // Descurtir - remover o like
        delete currentLikes[user.uid];
      } else {
        // Curtir - adicionar o like
        currentLikes[user.uid] = true;
      }

      await updateDoc(postRef, {
        [`comments.${commentKey}.likes`]: currentLikes
      });

      // Atualizar o estado local
      setComments(prev => prev.map(c => {
        if (c.timestamp === comment.timestamp && c.userId === comment.userId) {
          return { ...c, likes: currentLikes };
        }
        return c;
      }));

      // Atualizar o post local
      if (post) {
        const updatedComments = { ...post.comments };
        updatedComments[commentKey] = {
          ...updatedComments[commentKey],
          likes: currentLikes
        };
        setPost({
          ...post,
          comments: updatedComments
        });
      }

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

  // Real-time listener for post updates (likes & comments)
  useEffect(() => {
    if (!postId) return;

    const unsubscribe = onSnapshot(doc(firestore, 'posts', postId as string), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      const updatedPost: Post = { id: snapshot.id, ...(data as any) } as Post;

      // Update post core state
      setPost(updatedPost);

      // Likes logic
      setLikesCount(Object.keys(updatedPost.likes || {}).filter((key) => updatedPost.likes[key]).length);
      if (user) {
        setIsLiked(!!updatedPost.likes[user.uid]);
      }

      // Sort & set comments
      const sortedComments = Object.values(updatedPost.comments || {}).sort((a: Comment, b: Comment) => b.timestamp - a.timestamp);
      setComments(sortedComments);

      // Handle mention highlight
      if (user) {
        const blockedUserIds = blockedUsers.map((u) => u.id);
        const mentioned = sortedComments.find((c) => c.mentions?.includes(user.uid) && !blockedUserIds.includes(c.userId));
        setMentionedComment(mentioned || null);
      }
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, [postId, user?.uid, blockedUsers]);

  // Reset current image index when post changes
  useEffect(() => {
    setCurrentImgIdx(0);
  }, [post?.id]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background , paddingTop: StatusBar.currentHeight}]}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: themeColors.background , paddingBottom: insets.bottom}]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          {mentionedComment && (
            <TouchableOpacity
              style={[styles.mentionButton, { backgroundColor: 'rgba(255,0,0,0.3)' }]}
              onPress={scrollToMentionedComment}
            >
              <Ionicons name="notifications" size={24} color="#ff4444" />
            </TouchableOpacity>
          )}
          {!isMe && (
            <TouchableOpacity
              style={[styles.moreButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
              onPress={() => handleMorePress(postUser?.user || '')}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Post Header */}
          <View style={styles.postHeader}>
            <TouchableOpacity 
              style={styles.userInfo}
              onPress={() => router.push({
                pathname: '/SubTelas/perfil_outros',
                params: { userid: postUser?.id }
              })}
            >
              <View style={styles.avatarContainer}>
                <Image
                  source={require('@/assets/icons/aguiaa.png')}
                  style={[styles.avatar, { tintColor: themeColors.googleButton }]}
                />
                <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
              </View>
              <View style={styles.userTextInfo}>
                <Text style={[styles.username, { color: themeColors.googleButton }]}>
                  {postUser?.user}
                </Text>
                <Text style={[styles.timestamp, { color: themeColors.googleButton }]}>
                  {post && formatTime(post.timestamp)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Post Content */}
          <View style={styles.postContent}>
            {post?.images && (post.images || []).length > 0 ? (
              <>
                <View style={{position:'relative'}}>
                  <TouchableOpacity onPress={() => {setViewerIndex(currentImgIdx); setIsImageViewerVisible(true);}}>
                  <Image
                      source={{ uri: `data:image/jpeg;base64,${(post.images || [])[currentImgIdx]}` }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                  { (post.images || []).length > 1 && (
                    <>
                      <TouchableOpacity
                        style={styles.arrowLeft}
                        onPress={() => setCurrentImgIdx(idx => (idx - 1 + (post.images || []).length) % (post.images || []).length)}
                      >
                        <Ionicons name="chevron-back" size={28} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.arrowRight}
                        onPress={() => setCurrentImgIdx(idx => (idx + 1) % (post.images || []).length)}
                      >
                        <Ionicons name="chevron-forward" size={28} color="#fff" />
                      </TouchableOpacity>
                      <View style={styles.counterOverlay}>
                        <Text style={{color:'#fff'}}>{currentImgIdx+1}/{(post.images || []).length}</Text>
                      </View>
                    </>
                  )}
                </View>
                <Modal visible={isImageViewerVisible} transparent={true}>
                  <ImageViewer
                    imageUrls={(post.images || []).map(img => ({ url: `data:image/jpeg;base64,${img}` }))}
                    index={viewerIndex}
                    enableSwipeDown={true}
                    onSwipeDown={() => setIsImageViewerVisible(false)}
                    onClick={() => setIsImageViewerVisible(false)}
                    renderHeader={() => (
                      <TouchableOpacity style={styles.closeButton} onPress={() => setIsImageViewerVisible(false)}>
                        <Ionicons name="close" size={30} color="#fff" />
                      </TouchableOpacity>
                    )}
                  />
                </Modal>
              </>
            ) : post?.imageBase64 ? (
              <>
                <TouchableOpacity onPress={() => {setViewerIndex(0); setIsImageViewerVisible(true);}}>
                  <Image source={{ uri: `data:image/jpeg;base64,${post.imageBase64}` }} style={styles.postImage} resizeMode="cover" />
                </TouchableOpacity>
                <Modal visible={isImageViewerVisible} transparent={true}>
                  <ImageViewer
                    imageUrls={[{ url: `data:image/jpeg;base64,${post.imageBase64}` }]}
                    enableSwipeDown={true}
                    onSwipeDown={() => setIsImageViewerVisible(false)}
                    onClick={() => setIsImageViewerVisible(false)}
                    renderHeader={() => (
                      <TouchableOpacity style={styles.closeButton} onPress={() => setIsImageViewerVisible(false)}>
                        <Ionicons name="close" size={30} color="#fff" />
                      </TouchableOpacity>
                    )}
                  />
                </Modal>
              </>
            ) : null}
            <Text style={[styles.postText, { color: themeColors.googleButton }]}> {post?.text} </Text>

            {post?.ad && (
              <View style={{ marginTop:12, padding:12, borderRadius:8, backgroundColor: themeColors.tint }}>
                <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:4 }}>ANÚNCIO</Text>
                {post.adLinks && post.adLinks.length > 0 && post.adLinks.map((lnk, idx)=>(
                  <TouchableOpacity key={idx} onPress={()=> Linking.openURL(lnk)} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
                    <Ionicons name="link" size={18} color="#fff" />
                    <Text style={{ color:'#fff', marginLeft:6, textDecorationLine:'underline' }}>
                      {lnk.replace(/https?:\/\//,'')}
            </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Post Actions */}
          <View style={styles.postActions}>
            <TouchableOpacity 
              style={[styles.actionButton, isLiked && { backgroundColor: themeColors.tint }]}
              onPress={handleLike}
            >
              <Ionicons
                name={isLiked ? "thumbs-up" : "thumbs-up-outline"}
                size={24}
                color={isLiked ? "#fff" : themeColors.googleButton}
              />
              <Text style={[styles.actionText, { color: isLiked ? "#fff" : themeColors.googleButton }]}>
                {likesCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={24} color={themeColors.googleButton} />
              <Text style={[styles.actionText, { color: themeColors.googleButton }]}>
                {comments.length}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>Comentários</Text>
            <ScrollView>
              {comments.length === 0 ? (
                <Text style={{ color: themeColors.googleButton, opacity: 0.7 }}>Nenhum comentário ainda.</Text>
              ) : (
                comments.map((comment, index) => (
                  <CommentWithReadMore
                key={index}
                comment={comment}
                    themeColors={themeColors}
                    expanded={!!expandedComments[comment.timestamp]}
                    onExpand={() => handleExpandComment(comment.timestamp)}
                    onCollapse={() => setExpandedComments(prev => ({ ...prev, [comment.timestamp]: false }))}
                    onLike={() => handleLikeComment(comment)}
                    isLiked={!!comment.likes && !!user && !!comment.likes[user.uid]}
                    likesCount={comment.likes ? Object.values(comment.likes).filter(Boolean).length : 0}
                    disabled={likingComment === getCommentKey(comment)}
              />
                ))
              )}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.commentInputContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.commentInputWrapper}>
          <TextInput
            style={[styles.commentInput, { 
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: themeColors.googleButton
            }]}
            value={commentText}
              onChangeText={handleCommentTextChange}
            placeholder="Adicione um comentário..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            multiline
          />
            {renderMentionSuggestions()}
          </View>
          <TouchableOpacity
            style={[styles.sendButton, { 
              backgroundColor: commentText.trim() ? themeColors.tint : 'rgba(255,255,255,0.1)'
            }]}
            onPress={handleComment}
            disabled={!commentText.trim()}
          >
            <Ionicons 
              name="send" 
              size={24} 
              color={commentText.trim() ? "#fff" : "rgba(255,255,255,0.5)"} 
            />
          </TouchableOpacity>
        </View>

        {/* Modal de mais opções */}
        <Modal visible={moreOptionsVisible} transparent={true} animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMoreOptionsVisible(false)}
          >
            <View style={[styles.moreOptionsContainer, { backgroundColor: themeColors.background }]}>
              <TouchableOpacity
                style={[styles.moreOptionButton, { backgroundColor: 'rgba(255,0,0,0.2)' }]}
                onPress={handleBlockUser}
              >
                <Ionicons 
                  name="ban-outline" 
                  size={20} 
                  color="#ff4444" 
                  style={styles.moreOptionIcon}
                />
                <Text style={[styles.moreOptionText, { color: '#ff4444' }]}>
                  Bloquear Usuário
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal de bloqueio */}
        <BlockUserModal
          visible={blockModalVisible}
          onClose={() => setBlockModalVisible(false)}
          selectedUser={postUser?.user || null}
          onBlockUser={handleConfirmBlock}
        />
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          buttons={customAlert.buttons}
          onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
        />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default PostDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  appBar: {
    position: 'absolute',
    top: StatusBar.currentHeight,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: StatusBar.currentHeight ? StatusBar.currentHeight + 40 : 60,
  },
  postHeader: {
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userTextInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 14,
    opacity: 0.7,
  },
  postContent: {
    padding: 16,
  },
  postImage: {
    width: '100%',
    height: windowWidth,
    borderRadius: 12,
    marginBottom: 16,
  },
  postText: {
    fontSize: 16,
    lineHeight: 24,
  },
  postActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    padding: 8,
    borderRadius: 20,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  commentsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  commentItem: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  commentInputWrapper: {
    flex: 1,
    position: 'relative',
  },
  commentInput: {
    flex: 1,
    marginRight: 12,
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1000,
    padding: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  moreOptionIcon: {
    marginRight: 8,
  },
  moreOptionText: {
    fontSize: 16,
    fontWeight: '600',
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
  mentionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  arrowLeft: {
    position: 'absolute',
    top: '50%',
    left: 10,
    zIndex: 1000,
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowRight: {
    position: 'absolute',
    top: '50%',
    right: 10,
    zIndex: 1000,
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
}); 