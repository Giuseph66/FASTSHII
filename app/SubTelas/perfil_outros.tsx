import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useColorScheme, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

const UserProfileScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { usernome = 'Anonimos' } = useLocalSearchParams();
  const [profile, setProfile] = useState({ username: '', email: '', bio: '' });
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (usernome) {
      setProfile({
        username: usernome as string,
        bio: 'Esta é uma breve descrição sobre o usuário. Fale mais sobre seus interesses e atividades.',
      });
    } 
  }, [usernome]);

  const handleFollow = () => {
    setIsFollowing(prev => !prev);
  };

  const handleSendMessage = () => {
    router.push({
      pathname: '/SubTelas/chat',
      params: { 
        nomeConversa: profile.username,
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: themeColors.tint }]}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: '#fff' }]}>Perfil</Text>
        </View>

        {/* Conteúdo Principal */}
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Cabeçalho do Perfil */}
          <View style={[styles.profileHeader, { backgroundColor: themeColors.tint }]}>
            <View style={styles.profileImageContainer}>
              <Image
                source={{ uri: 'https://via.placeholder.com/150' }}
                style={styles.profileImage}
              />
            </View>
            <Text style={[styles.username, { color: '#fff' }]}>{profile.username}</Text>
            <Text style={[styles.bio, { color: 'rgba(255,255,255,0.8)' }]}>{profile.bio}</Text>
          </View>

          {/* Estatísticas */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: themeColors.googleButton }]}>0</Text>
              <Text style={[styles.statLabel, { color: themeColors.googleButton }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: themeColors.googleButton }]}>0</Text>
              <Text style={[styles.statLabel, { color: themeColors.googleButton }]}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: themeColors.googleButton }]}>0</Text>
              <Text style={[styles.statLabel, { color: themeColors.googleButton }]}>Seguindo</Text>
            </View>
          </View>

          {/* Botões de Ação */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isFollowing ? 'rgba(255,255,255,0.1)' : themeColors.tint }
              ]}
              onPress={handleFollow}
            >
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                {isFollowing ? 'Seguindo' : 'Seguir'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={handleSendMessage}
            >
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                Mensagem
              </Text>
            </TouchableOpacity>
          </View>

          {/* Posts do Usuário */}
          <View style={styles.postsContainer}>
            <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>Posts</Text>
            <View style={styles.postsGrid}>
              {/* Aqui você pode adicionar os posts do usuário em formato de grid */}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
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
    marginTop: 35,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
    marginHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  contentContainer: {
    flexGrow: 1,
  },
  profileHeader: {
    padding: 20,
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: -20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  postsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
