import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';
import { Image } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const users = JSON.parse((await AsyncStorage.getItem('user')) || '[]');
        if (users.length === 0) {
          router.replace('/login');
        } else {
          router.replace('/(tabs)/Perfil');
        }
      } catch (error) {
        console.error('Erro ao verificar o status de login:', error);
      }
    };

    if (loaded) {
      SplashScreen.hideAsync();
      checkLoginStatus();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            animation: 'fade'
          }} 
        />
        <Stack.Screen 
          name="register" 
          options={{ 
            headerShown: false,
            animation: 'fade'
          }} 
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            animation: 'fade'
          }}
        />
        <Stack.Screen 
          name="SubTelas/chat" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="SubTelas/perfil_outros" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="SubTelas/post_details" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="SubTelas/contrato_anuncio" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right'
          }} 
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
