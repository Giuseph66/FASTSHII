import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { firestore } from '@/firebaseConfig';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import ImageViewer from 'react-native-image-zoom-viewer';

interface MediaItem {
  id: string;
  image: string;
  timestamp: number;
}

const { width } = Dimensions.get('window');

const MediaGallery = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { chatId, participantId } = useLocalSearchParams();
  const router = useRouter();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  useEffect(() => {
    if (!chatId) return;
    const msgsRef = collection(firestore, 'chats', String(chatId), 'messages');
    const q = query(msgsRef, orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const items: MediaItem[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.image) {
          items.push({
            id: docSnap.id,
            image: `data:image/jpeg;base64,${data.image}`,
            timestamp: data.timestamp,
          });
        }
      });
      setMediaItems(items);
      setIsLoading(false);
    });
    return () => unsub();
  }, [chatId]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const groupMediaByDate = () => {
    const groups: { [key: string]: MediaItem[] } = {};
    mediaItems.forEach(item => {
      const date = formatDate(item.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });
    return Object.entries(groups).map(([date, items]) => ({
      date,
      items,
    }));
  };

  const renderItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity 
      style={styles.mediaItem}
      onPress={() => {
        const index = mediaItems.findIndex(m => m.id === item.id);
        setImageViewerIndex(index);
        setImageViewerVisible(true);
      }}
    >
      <Image source={{ uri: item.image }} style={styles.mediaImage} />
    </TouchableOpacity>
  );

  const renderSection = ({ item }: { item: { date: string; items: MediaItem[] } }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSearch }]}>{item.date}</Text>
      <View style={styles.mediaGrid}>
        {item.items.map(mediaItem => (
          <TouchableOpacity 
            key={mediaItem.id}
            style={styles.mediaItem}
            onPress={() => {
              const index = mediaItems.findIndex(m => m.id === mediaItem.id);
              setImageViewerIndex(index);
              setImageViewerVisible(true);
            }}
          >
            <Image source={{ uri: mediaItem.image }} style={styles.mediaImage} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.tint }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Galeria de Mídia</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass" size={32} color={themeColors.tint} />
          <Text style={{ color: themeColors.textSearch, marginTop: 8 }}>Carregando...</Text>
        </View>
      ) : mediaItems.length > 0 ? (
        <FlatList
          data={groupMediaByDate()}
          renderItem={renderSection}
          keyExtractor={item => item.date}
          contentContainerStyle={styles.mediaList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={48} color={themeColors.textSearch} />
          <Text style={{ color: themeColors.textSearch, marginTop: 8 }}>Nenhuma mídia encontrada</Text>
        </View>
      )}

      {/* Image Viewer Modal */}
      <Modal visible={imageViewerVisible} transparent={true} animationType="fade">
        <View style={styles.imageViewerContainer}>
          <ImageViewer
            imageUrls={mediaItems.map(item => ({ url: item.image }))}
            index={imageViewerIndex}
            backgroundColor="rgba(0,0,0,0.9)"
            enableSwipeDown
            onSwipeDown={() => setImageViewerVisible(false)}
            renderIndicator={(currentIndex, allSize) => (
              <View style={styles.indicatorContainer}>
                <Text style={styles.indicatorText}>{currentIndex} / {allSize}</Text>
              </View>
            )}
            onClick={() => setImageViewerVisible(false)}
            saveToLocalByLongPress={false}
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaList: {
    padding: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 5,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mediaItem: {
    width: (width - 40) / 3,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  indicatorText: {
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
});

export default MediaGallery; 