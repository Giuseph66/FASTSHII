import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Image, View, StyleSheet } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import translations from '@/locales/translations';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
        marginTop: 10,
      }}>
      <Image
        source={iconSource}
        style={{ width: size*1.2, height: size*1.2, tintColor: color }}
      />
    </View>
  );

  return (
        <Tabs
          screenOptions={{
            tabBarStyle: {
              backgroundColor: themeColors.background,
              shadowColor: themeColors.text,
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 5 },
              shadowRadius: 10,
              alignSelf: 'center',
              width: '100%',
              position: 'absolute' as const,
              bottom: 20,            },
            tabBarActiveTintColor: themeColors.tint,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarBackground: TabBarBackground,
            tabBarLabelStyle: {
              fontSize: 13,
              fontWeight: 'bold',
              top: 8,
            },
            tabBarItemStyle: {
              justifyContent: 'center',  // centraliza verticalmente
              alignItems: 'center',   
              bottom: 2, 
            },
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
        </Tabs>
  );
}

