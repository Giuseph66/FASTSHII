import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useColorScheme,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// Dados simulados para as mensagens
const mensagens = [
  {
    id: '1',
    remetente: 'Randy Mcdonald',
    trecho:
      "This was really great, i'm so glad that we could catchup this weekend.",
    horario: 'Seg. 3 de Julho - 16:12',
    avatar: require('@/assets/icons/aguiaa.png'),
  },
  {
    id: '2',
    remetente: 'John Doe',
    trecho: 'Hey, how are you doing?',
    horario: 'Seg. 3 de Julho - 14:30',
    avatar: require('@/assets/icons/aguiaa.png'),
  },
  {
    id: '3',
    remetente: 'Jane Smith',
    trecho: "Let's meet tomorrow at 10 AM.",
    horario: 'Seg. 3 de Julho - 12:45',
    avatar: require('@/assets/icons/aguiaa.png'),
  },
  {
    id: '4',
    remetente: 'Alice Johnson',
    trecho: 'Can you send me the report?',
    horario: 'Seg. 3 de Julho - 11:00',
    avatar: require('@/assets/icons/aguiaa.png'),
  },
];

const List11MessagesScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme(); // Detect system theme
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light; // Select theme colors

  const handleConversationPress = (remetente: string) => {
    router.push({
      pathname: '/SubTelas/chat',
      params: { nomeConversa: remetente },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: themeColors.tint }]}>
          <Text style={[styles.appBarTitle, { color: '#fff' }]}>Mensagens</Text>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {mensagens.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity
                onPress={() => handleConversationPress(item.remetente)}
                style={[styles.messageCard, { backgroundColor: themeColors.background }]}
              >
                <View style={[styles.avatarContainer, { backgroundColor: themeColors.tint }]}>
                  <Image 
                    source={item.avatar} 
                    style={[styles.avatar, { tintColor: '#fff' }]} 
                  />
                </View>
                <View style={styles.messageContent}>
                  <Text style={[styles.remetente, { color: themeColors.googleButton }]}>{item.remetente}</Text>
                  <Text style={[styles.trecho, { color: themeColors.icon }]} numberOfLines={1}>{item.trecho}</Text>
                  <View style={styles.messageFooter}>
                    <Text style={[styles.horario, { color: themeColors.icon }]}>{item.horario}</Text>
                    <Ionicons name="chevron-forward" size={24} color={themeColors.icon} />
                  </View>
                </View>
              </TouchableOpacity>
              {index < mensagens.length - 1 && (
                <View style={[styles.divider, { backgroundColor: themeColors.icon }]} />
              )}
            </View>
          ))}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default List11MessagesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  appBar: {
    height: 60,
    width: '96%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    paddingHorizontal: 20,
    marginTop: 45,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchButton: {
    padding: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  messageContent: {
    flex: 1,
  },
  remetente: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trecho: {
    fontSize: 14,
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  horario: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});
