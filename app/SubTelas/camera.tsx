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

} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { fetchUsers, fetchImages, fetchPosts } from '@/utils/firebaseQueries';

// Exemplo de uso:
const FastShiiiScreen = () => {
  const [posts, setPosts] = useState([]); // Estado para armazenar os posts
  const [inputText, setInputText] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [createPostModalVisible, setCreatePostModalVisible] = useState(false); // Modal for creating posts
  const [viewPostModalVisible, setViewPostModalVisible] = useState(false); // Modal for viewing posts
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null); // Estado para o post selecionado
  const [switchValue1, setSwitchValue1] = useState(true);
  const [switchValue2, setSwitchValue2] = useState(true);
  const [switchValue3, setSwitchValue3] = useState(true);
  const [choiceChipsValue, setChoiceChipsValue] = useState('Populares');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string; uid: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          console.error('Nenhum usuário encontrado no AsyncStorage.');
          router.replace('/login'); // Redireciona para login se não houver usuário
        }
      } catch (error) {
        console.error('Erro ao carregar usuário do AsyncStorage:', error);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user'); // Remove os dados do usuário
    router.replace('/login'); // Redireciona para a tela de login
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
      const photo = await cameraRef.current.takePictureAsync();
      setSelectedImage(photo.uri);
      setCameraModalVisible(false);
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

    try {
      let imageId = null;

      if (selectedImage) {
        console.log('Comprimindo a imagem...');
        const compressedImage = await ImageManipulator.manipulateAsync(
          selectedImage,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        console.log('Convertendo a imagem para Base64...');
        const fotoBase64 = await FileSystem.readAsStringAsync(compressedImage.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        

        console.log('Enviando a imagem para o Firestore...');
        const fotoData = {
          base64: fotoBase64,
          timestamp: Date.now(),
        };
        const docRef = await addDoc(collection(firestore, 'fotos'), fotoData);
        imageId = docRef.id;
      }

      console.log('Salvando a postagem no Firestore...');
      const postData = {
        userId: user.uid, 
        text: inputText || '',
        timestamp: Date.now(),
        likes: {}, // JSON vazio para armazenar quem curtiu
        comments: {}, // JSON vazio para armazenar os comentários
        imageId: imageId, // ID da imagem salva (ou null se não houver imagem)
      };

      const postDocRef = await addDoc(collection(firestore, 'posts'), postData);
      console.log('Postagem salva com ID:', postDocRef.id);

      Alert.alert('Sucesso', 'Postagem adicionada com sucesso!');
      setInputText('');
      setSelectedImage(null);
      setModalVisible(false);
    } catch (error) {
      console.error('Erro ao adicionar postagem:', error.message);
      Alert.alert('Erro', 'Erro ao adicionar postagem: ' + error.message);
    }
  };
  // Dados simulados para os posts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const users = await fetchUsers();
        const images = await fetchImages();
        const posts = await fetchPosts();

        //console.log('Imagens:', images);
        //console.log('Usuários:', users);
        //console.log('Posts:', posts);

        // Processar imagens no formato Base64 com prefixo
        const processedImages = images.map((img) => ({
          ...img,
          base64: `data:image/jpeg;base64,${img.base64}`,
        }));

        // Exemplo de manipulação dos dados retornados
        const formattedPosts = posts.map((post) => {
          const user = users.find((u) => u.id === post.userId) || { user: 'Usuário Desconhecido' };
          const image = processedImages.find((img) => img.id === post.imageId) || null;

          // Calcular o tempo decorrido
          const postTime = new Date(post.timestamp);
          const currentTime = new Date();
          const timeDifference = Math.floor((currentTime.getTime() - postTime.getTime()) / 1000); // Diferença em segundos

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
            time: timeString, // Tempo formatado
            content: post.text,
            likes: Object.keys(post.likes || {}).length,
            comments: Object.keys(post.comments || {}).length,
            image: image ? image.base64 : null, // Usar a imagem processada
          };
        });

        setPosts(formattedPosts); // Atualiza o estado com os posts formatados
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    };

    fetchData();
  }, []);

  const renderPost = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedPost(item);
        setViewPostModalVisible(true); // Open the view post modal
      }}
    >
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <Text style={styles.postUsername}>{item.username}</Text>
          <Text style={styles.postTime}>{item.time}</Text>
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
        {item.image && (
        
          <Image
            source={{ uri: item.image.startsWith('data:image') ? item.image : `data:image/jpeg;base64,${item.image}` }}
            style={styles.postImage}
          />
        )}
        <View style={styles.postFooter}>
          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => console.log('Like pressed')}>
              <Ionicons name="thumbs-up-outline" size={20} color="#000" />
            </TouchableOpacity>
            <Text style={styles.postActionText}>{item.likes}</Text>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => console.log('Comment pressed')}>
              <Ionicons name="chatbubble-outline" size={20} color="#000" />
            </TouchableOpacity>
            <Text style={styles.postActionText}>{item.comments}</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => console.log('More pressed')}>
            <Ionicons name="ellipsis-vertical" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Componente para os Choice Chips
  const Chip = ({ label, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
      onPress={onPress}>
      <Text style={selected ? styles.chipTextSelected : styles.chipTextUnselected}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>S H I I I I</Text>
        <TouchableOpacity onPress={() => setDrawerVisible(true)} style={styles.appBarIcon}>
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* End Drawer implementado via Modal */}
      <Modal visible={drawerVisible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.drawerOverlay}
          onPress={() => setDrawerVisible(false)}
        />
        <View style={styles.drawer}>
          <ScrollView contentContainerStyle={styles.drawerContent}>
            <Text style={styles.drawerTitle}>Configurações</Text>

            <Text style={styles.drawerSubtitle}>Privacidade</Text>
            <TouchableOpacity
              style={styles.drawerOption}
              onPress={() => console.log('Quem pode ver meus comentários')}>
              <Text style={styles.drawerOptionText}>Quem pode ver meus comentários</Text>
              <Ionicons name="chevron-forward-outline" size={24} color="#FFA500" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerOption}
              onPress={() => console.log('Usuários bloqueados')}>
              <Text style={styles.drawerOptionText}>Usuários bloqueados</Text>
              <Ionicons name="chevron-forward-outline" size={24} color="#FFA500" />
            </TouchableOpacity>

            <Text style={[styles.drawerSubtitle, { marginTop: 20 }]}>Notificações</Text>
            <View style={styles.drawerOption}>
              <Text style={styles.drawerOptionText}>Respostas aos meus comentários</Text>
              <Switch
                value={switchValue1}
                onValueChange={setSwitchValue1}
                trackColor={{ false: '#1E1E3F', true: '#FFA500' }}
                thumbColor={switchValue1 ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
            <View style={styles.drawerOption}>
              <Text style={styles.drawerOptionText}>Curtidas nos meus comentários</Text>
              <Switch
                value={switchValue2}
                onValueChange={setSwitchValue2}
                trackColor={{ false: '#1E1E3F', true: '#FFA500' }}
                thumbColor={switchValue2 ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
            <View style={styles.drawerOption}>
              <Text style={styles.drawerOptionText}>Tópicos populares</Text>
              <Switch
                value={switchValue3}
                onValueChange={setSwitchValue3}
                trackColor={{ false: '#1E1E3F', true: '#FFA500' }}
                thumbColor={switchValue3 ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
            <TouchableOpacity style={styles.drawerButton} onPress={handleLogout}>
              <Text style={styles.drawerButtonText}>Sair da conta</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal para adicionar nova postagem */}
      <Modal visible={createPostModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Postagem</Text>
            <TextInput
              style={styles.modalInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escreva algo..."
              placeholderTextColor="#666"
            />
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.modalImagePreview} />
            )}
            <TouchableOpacity style={styles.modalButton} onPress={handleImagePicker}>
              <Text style={styles.modalButtonText}>Carregar Imagem</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalButton} onPress={handleTakePhoto}>
              <Text style={styles.modalButtonText}>Tirar Foto</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalActionButton} onPress={handleAddPost}>
                <Text style={styles.modalActionButtonText}>Postar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, styles.modalCancelButton]}
                onPress={() => setCreatePostModalVisible(false)} // Fecha o modal corretamente
              >
                <Text style={styles.modalActionButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal da câmera */}
      <Modal visible={cameraModalVisible} transparent={false} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} />
          <TouchableOpacity style={styles.captureButton} onPress={handleCapturePhoto}>
            <Text style={styles.captureButtonText}>Capturar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeCameraButton}
            onPress={() => setCameraModalVisible(false)}
          >
            <Text style={styles.closeCameraButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal para exibir detalhes do post */}
      <Modal visible={viewPostModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewPostModalVisible(false)}>
            <Text style={styles.modalCloseText}>Fechar</Text>
          </TouchableOpacity>
          {selectedPost && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedPost.username}</Text>
              <Text style={styles.modalTime}>{selectedPost.time}</Text>
              <Text style={styles.modalText}>{selectedPost.content}</Text>
              {selectedPost.image && (
                <Image
                  source={{ uri: selectedPost.image.startsWith('data:image') ? selectedPost.image : `data:image/jpeg;base64,${selectedPost.image}` }}
                  style={styles.modalImage}
                />
              )}
              <Text style={styles.modalLikes}>Curtidas: {selectedPost.likes}</Text>
              <Text style={styles.modalComments}>Comentários: {selectedPost.comments}</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Corpo da tela */}
      <View style={styles.body}>
        {/* Campo de Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Compartilhe seus pensamentos..."
            placeholderTextColor="#666"
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setCreatePostModalVisible(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Choice Chips */}
        <View style={styles.chipsContainer}>
          <Chip
            label="Populares"
            selected={choiceChipsValue === 'Populares'}
            onPress={() => setChoiceChipsValue('Populares')}
          />
          <Chip
            label="Recentes"
            selected={choiceChipsValue === 'Recentes'}
            onPress={() => setChoiceChipsValue('Recentes')}
          />
        </View>

        {/* Lista de Posts */}
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.postsList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => Alert.alert(user.uid)}>
        <Ionicons name="filter-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default FastShiiiScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151142', // Fundo escuro
    padding: 16,
  },
  // AppBar
  appBar: {
    marginTop: 35, // Espaçamento da parte superior da tela
    height: 56,
    backgroundColor: '#6200EE', // cor primária
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 12, // Bordas arredondadas
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4, // Sombra para Android
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  appBarIcon: {
    position: 'absolute',
    right: 16,
  },
  // Drawer
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 380, // Aumentei a largura da barra lateral
    backgroundColor: '#151142', // Fundo escuro
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
    color: '#FFA500', // Laranja
    marginBottom: 24,
    textAlign: 'center',
  },
  drawerSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF', // Branco
    marginBottom: 12,
  },
  drawerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E1E3F', // Azul escuro
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  drawerOptionText: {
    fontSize: 16,
    color: '#FFFFFF', // Branco
  },
  drawerButton: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FF0000', // cor de erro
    borderRadius: 8,
    alignItems: 'center',
  },
  drawerButtonText: {
    fontSize: 16,
    color: '#FF0000', // cor de erro
  },
  // Corpo
  body: {
    flex: 1,
  },
  inputContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FFA500', // Laranja
    padding: 10,
    borderRadius: 20,
    color: '#FFFFFF', // Branco
    backgroundColor: '#1E1E3F', // Azul escuro
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#FFA500', // Laranja
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  chipSelected: {
    backgroundColor: '#FFA500', // Laranja
  },
  chipUnselected: {
    backgroundColor: '#1E1E3F', // Azul escuro
    borderWidth: 1,
    borderColor: '#FFA500', // Laranja
  },
  chipTextSelected: {
    color: '#FFFFFF', // Branco
    fontWeight: 'bold',
  },
  chipTextUnselected: {
    color: '#FFA500', // Laranja
  },
  postsList: {
    paddingBottom: 16,
  },
  postContainer: {
    backgroundColor: '#1E1E3F', // Azul escuro
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  postUsername: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#FFA500', // Laranja
  },
  postTime: {
    fontSize: 12,
    color: '#999', // Cinza claro
  },
  postContent: {
    fontSize: 14,
    color: '#FFFFFF', // Branco
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 8,
  },
  postActionText: {
    fontSize: 14,
    color: '#FFFFFF', // Branco
    marginRight: 16,
  },
  // Floating Action Button (FAB)
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6200EE', // cor primária
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.73)', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.73)', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff', // Azul escuro
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    color: '#000',
  },
  modalImagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  modalButton: {
    backgroundColor: '#FFA500',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalActionButton: {
    flex: 1,
    backgroundColor: '#FFA500',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalCancelButton: {
    backgroundColor: '#ccc',
  },
  modalActionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
    backgroundColor: '#FFA500',
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
    backgroundColor: '#FFA500',
    padding: 10,
    borderRadius: 8,
  },
  closeCameraButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTime: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    height: 200,
    marginBottom: 16,
    borderRadius: 8,
  },
  modalLikes: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  modalComments: {
    fontSize: 16,
    color: '#fff',
  },
});
