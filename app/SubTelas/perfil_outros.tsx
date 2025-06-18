import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  useColorScheme, 
  Image, 
  Dimensions,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/firebaseConfig';
import { collection, query, where, getDocs, orderBy, getDoc, doc, addDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BlockUserModal from '@/components/BlockUserModal';
import CustomAlert from '@/components/CustomAlert';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

interface Post {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
  likes: Record<string, boolean>;
  comments: Record<string, any>;
  imageBase64: string | null;
}

interface User {
  id: string;
  user: string;
  email: string;
  bio?: string;
  followers?: string[];
  following?: string[];
  username?: string;
  uid?: string;
}

const UserProfileScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { userid = 'Anonimos' } = useLocalSearchParams();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const insets = useSafeAreaInsets();
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [myUser, setMyUser] = useState<User | null>(null);
  const [loading_message, setLoading_message] = useState(false);
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

  const fetchUserProfile = async () => {
    try {
      console.log(userid);
      const userRef = doc(firestore, 'usuarios' , userid as string);
      const querySnapshot = await getDoc(userRef);
      if (querySnapshot.exists()) {
        const userData = querySnapshot.data() as User;
        setProfile({ ...userData, id: querySnapshot.id });
      }
      const data = await AsyncStorage.getItem('user');
      if (data) {
        const user = JSON.parse(data);
        setMyUser(user);
        if (user.uid === userid) {
          setIsMe(true);
        }else{
          setIsMe(false);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const fetchUserPosts = async () => {
    try {
      if (!userid) return;
      
      const postsRef = collection(firestore, 'posts');
      let userPosts: Post[] = [];
      try {
        // Try the compound query first
        const q = query(
          postsRef,
          where('userId', '==', userid),
          orderBy('timestamp', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        userPosts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Post[];
      } catch (error: any) {
        // If the index is not ready, fall back to a simpler query
        if (error.code === 'failed-precondition') {
          console.log('Index not ready, using fallback query');
          const fallbackQuery = query(
            postsRef,
            where('userId', '==', userid)
          );
          
          const fallbackSnapshot = await getDocs(fallbackQuery);
          userPosts = fallbackSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Post[];
          
          // Sort the results in memory
          userPosts.sort((a, b) => b.timestamp - a.timestamp);
        } else {
          throw error;
        }
      }
      
      setPosts(userPosts);
    } catch (error) {
      console.error('Erro ao buscar posts:', error);
    }
  };

  useEffect(() => {
    // Carrega dados iniciais (perfil, posts, myUser, isMe)
    fetchUserProfile();
    fetchUserPosts();
    setLoading(false);
  }, [userid]);

  useEffect(() => {
    // Atualização em tempo real do perfil
    let unsubscribe: (() => void) | null = null;
    const listenProfile = async () => {
      if (!userid) return;
      const userRef = doc(firestore, 'usuarios', userid as string);
      unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          setProfile({ ...userData, id: docSnap.id });
        }
      });
    };
    listenProfile();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userid]);

  useEffect(() => {
    // Atualiza o estado do botão de seguir em tempo real
    if (!profile || !myUser) {
      setIsFollowing(false);
      return;
    }
    setIsFollowing(!!profile.followers?.includes(myUser.uid || ''));
  }, [profile, myUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    await fetchUserPosts();
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!profile || !myUser) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível identificar os usuários para seguir/deixar de seguir.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    };
    const userToFollowRef = doc(firestore, 'usuarios', profile.id);
    const myUserRef = doc(firestore, 'usuarios', myUser.uid || '');
    try {
      if (isFollowing) {
        await updateDoc(userToFollowRef, {
          followers: arrayRemove(myUser.uid)
        });
        await updateDoc(myUserRef, {
          following: arrayRemove(profile.id)
        });
        setIsFollowing(false);
      } else {
        // Seguir
        await updateDoc(userToFollowRef, {
          followers: arrayUnion(myUser.uid)
        });
        await updateDoc(myUserRef, {
          following: arrayUnion(profile.id)
        });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Erro ao seguir/deixar de seguir:', error);
    }
  };

  const handleBlockUser = () => {
    setBlockModalVisible(true);
  };

  const handleConfirmBlock = (username: string) => {
    console.log( "handleConfirmBlock", username);
    setCustomAlert({
      visible: true,
      title: 'Usuário Bloqueado',
      message: `Você bloqueou o usuário ${username}.`,
      buttons: [
        {
          text: 'OK',
          style: 'default',
          onPress: () => {
            router.back();
          }
        }
      ]  
    });
  };

  const handleSendMessage = async () => {
    setLoading_message(true)
    console.log( "profile?.user", profile?.user);
    console.log( "myUser?.username", myUser?.username);
    const displayName = profile?.user === myUser?.username ? "Eu" : (profile?.user || '');
    if (!profile?.user || !myUser?.username) {
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível identificar os usuários para iniciar a conversa.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
      return;
    }
    const userA = displayName;
    const userB = myUser.username;
    const chatsRef = collection(firestore, 'chats');
    // Buscar todos os chats onde o usuário logado participa
    const q = query(
      chatsRef,
      where('participants', 'array-contains', userB)
    );
    const querySnapshot = await getDocs(q);
    // Procurar se já existe um chat entre os dois usuários
    let foundChat: any = null;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (
        Array.isArray(data.participants) &&
        data.participants.includes(userA) &&
        data.participants.includes(userB) &&
        data.participants.length === 2
      ) {
        foundChat = docSnap;
      }
    });
    const otherUser = userA === userB ? userA : (userA === myUser.username ? userB : userA);
    if (foundChat !== null) {
      // Usar customNames do chat existente
      const customNames = foundChat.data().customNames || {};
      const displayName = customNames[otherUser] || otherUser;
      router.push({
        pathname: '/SubTelas/chat',
        params: {
          chatId: foundChat.id,
          nomeConversa: displayName,
        }
      });
    } else {
      // Criar novo chat
    setLoading_message(false)

      const chatRef = await addDoc(chatsRef, {
        createdAt: Date.now(),
        participants: [userA, userB],
        customNames: {
          [userA]: userA,
          [userB]: userB
        },
        lastMessage: '',
        lastMessageTime: Date.now(),
      });
      const displayName = foundChat.data().customNames[otherUser] || otherUser;
      router.push({
        pathname: '/SubTelas/chat',
        params: {
          chatId: chatRef.id,
          nomeConversa: displayName,
        }
      });
    }
    setLoading_message(false)
  };

  const renderPost = ({ item }: { item: Post }) => {
    return (
      <TouchableOpacity
        style={styles.postGridItem}
        onPress={() => router.push({
          pathname: '/SubTelas/post_details',
          params: { postId: item.id }
        })}
      >
        {item.imageBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }}
            style={styles.postGridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.postGridImage, styles.noImageContainer]}>
            <Text style={[styles.noImageText, { color: themeColors.googleButton }]} numberOfLines={3}>
              {item.text}
            </Text>
          </View>
        )}
        {item.likes && Object.keys(item.likes).length > 0 && (
          <View style={styles.postOverlay}>
            <Ionicons name="heart" size={20} color="#fff" />
            <Text style={styles.postOverlayText}>
              {Object.keys(item.likes).length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
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
    <View style={[styles.container, { backgroundColor: themeColors.background , paddingBottom: insets.bottom}]}>
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
              onPress={() => handleBlockUser()}
              style={[styles.moreButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
            >
              <Ionicons name="ban" size={24} color="red" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Profile Header */}
          <View style={styles.profileHeaderContainer}>
            <LinearGradient
              colors={[themeColors.tint, themeColors.tint + '80']}
              style={styles.profileHeaderGradient}
            >
              <View style={styles.profileHeaderContent}>
                <View style={styles.profileImageContainer}>
                  <Image
                    source={require('@/assets/icons/aguiaa.png')} 
                    style={[styles.profileImage, { tintColor: '#fff' }]} 
                  />
                  <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.username, { color: '#fff' }]}>{profile?.user}</Text>
                  <Text style={[styles.bio, { color: 'rgba(255,255,255,0.8)' }]}>
                    {profile?.bio || 'Nenhuma biografia disponível'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Stats */}
            <View style={[styles.statsContainer, { backgroundColor: themeColors.background }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: themeColors.googleButton }]}>
                  {posts.length}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.googleButton }]}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: themeColors.googleButton }]}>
                  {profile?.followers?.length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.googleButton }]}>Seguidores</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: themeColors.googleButton }]}>
                  {profile?.following?.length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.googleButton }]}>Seguindo</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              {!isMe && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: isFollowing ? 'rgba(255,255,255,0.1)' : themeColors.tint }
                ]}
                onPress={handleFollow}
              >
                <Ionicons 
                  name={isFollowing ? "checkmark" : "add"} 
                  size={20} 
                  color="#fff" 
                  style={styles.actionButtonIcon}
                />
                <Text style={[styles.actionButtonText, { color: isFollowing ? themeColors.textSearch : themeColors.textSeguir }]}>
                  {isFollowing ? 'Seguindo' : 'Seguir'}
                </Text>
              </TouchableOpacity>)}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                onPress={handleSendMessage}
                disabled={loading_message}
              >
                {loading_message ? (
                  <Ionicons 
                  name="chatbubble-outline" 
                  size={20} 
                  color="#fff" 
                  style={styles.actionButtonIcon}
                />
                ) : (
                  <Ionicons 
                  name="chatbubble-sharp" 
                  size={20} 
                  color="#fff" 
                  style={styles.actionButtonIcon}
                />
                )}
                <Text style={[styles.actionButtonText, { color: themeColors.textSearch }]}>
                  {loading_message ? 'Abrindo conversa...' : 'Mensagem'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Posts Grid */}
          <View style={styles.postsGridContainer}>
            {posts.length > 0 ? (
              <FlatList
                data={posts}
                renderItem={renderPost}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                contentContainerStyle={styles.postsGrid}
              />
            ) : (
              <View style={styles.noPostsContainer}>
                <Text style={[styles.noPostsText, { color: themeColors.googleButton }]}>
                  Nenhum post ainda
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
      <BlockUserModal
        visible={blockModalVisible}
        onClose={() => setBlockModalVisible(false)}
        selectedUser={profile?.user || null}
        onBlockUser={handleConfirmBlock}
      />
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

export default UserProfileScreen;

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
  contentContainer: {
    
    flexGrow: 1,
  },
  profileHeaderContainer: {
    marginTop: 0,
  },
  profileHeaderGradient: {
    paddingTop:  StatusBar.currentHeight ? StatusBar.currentHeight + 60 : 60,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  postsGridContainer: {
    flex: 1,
    padding: 1,
  },
  postsGrid: {
    padding: 1,
  },
  postGridItem: {
    flex: 1/3,
    aspectRatio: 1,
    padding: 1,
  },
  postGridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  noImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  noImageText: {
    fontSize: 12,
    textAlign: 'center',
  },
  postOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 12,
  },
  postOverlayText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  noPostsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noPostsText: {
    fontSize: 16,
    opacity: 0.7,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
});
