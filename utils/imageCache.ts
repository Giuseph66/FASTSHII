import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'cached_images';
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

export const getCachedImage = async (imageId: string): Promise<string | null> => {
  try {
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const { images, timestamp } = JSON.parse(cachedData);

      // Check if the cache is still valid
      if (Date.now() - timestamp < CACHE_DURATION) {
        const cachedImage = images.find((img: { id: string }) => img.id === imageId);
        if (cachedImage) {
          return cachedImage.base64; // Return the cached image
        }
      }
    }
    return null; // Image not found in cache
  } catch (error) {
    console.error('Erro ao buscar imagem no cache:', error);
    return null;
  }
};

export const cacheImage = async (imageId: string, base64: string): Promise<void> => {
  try {
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);
    const now = Date.now();
    let cache = cachedData ? JSON.parse(cachedData) : { images: [], timestamp: now };

    // Check if the image is already cached
    const isCached = cache.images.some((img: { id: string }) => img.id === imageId);
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
