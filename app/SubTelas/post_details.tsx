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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/firebaseConfig';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
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
  imageBase64: string | null;
}

interface Comment {
  userId: string;
  text: string;
  timestamp: number;
  username?: string;
}

interface User {
  uid: string;
  id: string;
  user: string;
  username: string;
  email: string;
}

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
  }, [postId]);

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
            {post?.imageBase64 && (
              <>
                <TouchableOpacity onPress={() => setIsImageViewerVisible(true)}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${post.imageBase64}` }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <Modal visible={isImageViewerVisible} transparent={true}>
                  <ImageViewer
                    imageUrls={[{ url: `data:image/jpeg;base64,${post.imageBase64}` }]}
                    enableSwipeDown={true}
                    onSwipeDown={() => setIsImageViewerVisible(false)}
                    onClick={() => setIsImageViewerVisible(false)}
                    renderHeader={() => (
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setIsImageViewerVisible(false)}
                      >
                        <Ionicons name="close" size={30} color="#fff" />
                      </TouchableOpacity>
                    )}
                  />
                </Modal>
              </>
            )}
            <Text style={[styles.postText, { color: themeColors.googleButton }]}>
              {post?.text}
            </Text>
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
            <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
              Comentários
            </Text>
            {comments.map((comment, index) => (
              <CommentItem
                key={index}
                comment={comment}
                username={
                  comment.userId === user?.uid
                    ? 'Você'
                    : commentUsernames[comment.userId] || comment.username || 'Usuário'
                }
                isOwnComment={comment.userId === user?.uid}
                onMention={(c) => setCommentText(prev => prev + `@${commentUsernames[comment.userId] || comment.username || 'Usuário'} `)}
                onEdit={async (newText) => {
                  const commentKey = getCommentKey(comment);
                  if (post && commentKey) {
                    const postRef = doc(firestore, 'posts', post.id);
                    await updateDoc(postRef, {
                      [`comments.${commentKey}.text`]: newText
                    });
                    setComments(prev => prev.map(c =>
                      c.timestamp === comment.timestamp && c.userId === comment.userId
                        ? { ...c, text: newText }
                        : c
                    ));
                  }
                }}
                onDelete={async () => {
                  const commentKey = getCommentKey(comment);
                  if (post && commentKey) {
                    const postRef = doc(firestore, 'posts', post.id);
                    await updateDoc(postRef, {
                      [`comments.${commentKey}`]: deleteField()
                    });
                    setComments(prev => prev.filter(c => c.timestamp !== comment.timestamp || c.userId !== comment.userId));
                  }
                }}
                formatTime={formatTime}
              />
            ))}
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.commentInputContainer, { backgroundColor: themeColors.background }]}>
          <TextInput
            style={[styles.commentInput, { 
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: themeColors.googleButton
            }]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Adicione um comentário..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            multiline
          />
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
    top: 35,
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
    marginTop: 90,
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
}); 