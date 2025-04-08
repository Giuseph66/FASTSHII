import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Image, View, StyleSheet } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import translations from '@/locales/translations';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Idioma atual
const currentLanguage = 'pt'; // Altere para 'en' para inglês

interface TabBarIconProps {
  color: string;
  size: number;
  focused: boolean;
}

export default function TabLayout() {
  const colorScheme = useColorScheme(); // Detect system theme
  const themeColors = Colors[colorScheme ?? 'light']; // Select theme colors

  // Estilo customizado para a tab bar fixa na parte inferior
  const tabBarStyle = {
    height: 60,
    borderRadius: 30,
    backgroundColor: themeColors.background, // Use dynamic background color
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: themeColors.text, // Use dynamic shadow color
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
  };

  // Função auxiliar para renderizar o ícone com efeito dinâmico
  const renderTabIcon = (iconSource: any) => ({ color, size, focused }: TabBarIconProps) => (
    <View
      style={{
        elevation: focused ? 10 : 0,
        shadowColor: themeColors.tint, // Use dynamic tint color
        shadowOffset: { width: 0, height: focused ? 5 : 0 },
        shadowOpacity: focused ? 0.3 : 0,
        shadowRadius: focused ? 10 : 0,
        padding: focused ? 6 : 0,
        borderRadius: focused ? size : 0,
        backgroundColor: focused ? themeColors.background : 'transparent',
      }}>
      <Image
        source={iconSource}
        style={{ width: size, height: size, tintColor: color }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: themeColors.tint, // Use dynamic tint color
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarBackground: TabBarBackground,
            tabBarStyle: Platform.select({
              ios: tabBarStyle,
              default: tabBarStyle,
            }),
          }}>
          <Tabs.Screen
            name="Perfil"
            options={{
              title: translations[currentLanguage].tabs.profile,
              tabBarIcon: renderTabIcon(require('@/assets/icons/perfil.png')),
            }}
          />
          <Tabs.Screen
            name="feed"
            options={{
              title: translations[currentLanguage].tabs.feed,
              tabBarIcon: renderTabIcon(require('@/assets/icons/SHH.png')),
            }}
          />
          <Tabs.Screen
            name="conversas"
            options={{
              title: translations[currentLanguage].tabs.conversas,
              tabBarIcon: renderTabIcon(require('@/assets/icons/chat.png')),
            }}
          />
          <Tabs.Screen
            name="camera"
            options={{
              title: "Camera",
              tabBarIcon: renderTabIcon(require('@/assets/icons/camera.png')),
            }}
          />
        </Tabs>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
});
