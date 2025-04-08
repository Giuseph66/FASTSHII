import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'cached_images';

// Get cached image by ID
export const getCachedImage = async (imageId: string) => {
  try {
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);
    if (!cachedData) return null;

    const { images } = JSON.parse(cachedData);
    return images.find((img: { id: string }) => img.id === imageId) || null;
  } catch (error) {
    console.error('Erro ao buscar imagem no cache:', error);
    return null;
  }
};

// Cache an image
export const cacheImage = async (imageId: string, base64: string) => {
  try {
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);
    const now = Date.now();
    let cache = cachedData ? JSON.parse(cachedData) : { images: [], timestamp: now };

    // Check if the image is already cached
    const isCached = cache.images.some((img: { id: string }) => img.id === imageId);
    if (!isCached) {
      cache.images.push({ id: imageId, base64 });
      cache.timestamp = now; // Update the timestamp
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error('Erro ao salvar imagem no cache:', error);
  }
};
