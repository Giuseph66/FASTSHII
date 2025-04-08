import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, ActivityIndicator, View, Dimensions } from 'react-native';
import { getCachedImage, cacheImage } from '@/utils/imageCache';

interface ImageDisplayProps {
  imageId: string;
  base64?: string; // Optional base64 string for immediate display
  style?: object;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageId, base64, style }) => {
  const [imageUri, setImageUri] = useState<string | null>(base64 || null);
  const [loading, setLoading] = useState(!base64);

  const screenWidth = Dimensions.get('window').width;
  const imageWidth = screenWidth - 40; // Full width minus 20px margins on each side

  useEffect(() => {
    const fetchImage = async () => {
      if (!base64) {
        const cachedImage = await getCachedImage(imageId);
        if (cachedImage) {
          setImageUri(`data:image/jpeg;base64,${cachedImage}`);
        } else {
          console.warn(`Image with ID ${imageId} not found in cache.`);
        }
        setLoading(false);
      } else {
        await cacheImage(imageId, base64); // Cache the image if base64 is provided
      }
    };

    fetchImage();
  }, [imageId, base64]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { width: imageWidth }, style]}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  return imageUri ? (
    <Image
      source={{ uri: imageUri }}
      style={[styles.image, { width: imageWidth }, style]}
      resizeMode="contain"
    />
  ) : null;
};

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center', // Center the image horizontally
    marginHorizontal: 20, // Add 20px lateral margins
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    alignSelf: 'center',
    marginHorizontal: 20, // Add 20px lateral margins
  },
});

export default ImageDisplay;
