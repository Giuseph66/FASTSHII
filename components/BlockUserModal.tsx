import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { doc, updateDoc, getDoc, arrayUnion, where, collection, query, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import CustomAlert from '@/components/CustomAlert';
 

interface BlockUserModalProps {
  visible: boolean;
  onClose: () => void;
  selectedUser: string | null;
  onBlockUser: (username: string) => void;
}


const BlockUserModal: React.FC<BlockUserModalProps> = ({
  visible,
  onClose,
  selectedUser,
  onBlockUser,
}) => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [blockUsername, setBlockUsername] = useState('');
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: {
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[];
  }>({ visible: false, title: '', message: '', buttons: [] });
  
  const handleConfirmBlock = async () => {
    try {
      if (!blockUsername.trim() || !selectedUser) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Dados inválidos para bloqueio',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      if (blockUsername.trim() !== selectedUser) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Nome de usuário não corresponde',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      // Buscar usuário logado
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Usuário não autenticado',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      const currentUser = JSON.parse(userStr);

      // Buscar usuário a ser bloqueado
      const userToBlockQuery = query(
        collection(firestore, 'usuarios'),
        where('user', '==', blockUsername)
      );
      const userToBlockSnapshot = await getDocs(userToBlockQuery);

      if (userToBlockSnapshot.empty) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Usuário não encontrado',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      const userToBlockData = userToBlockSnapshot.docs[0].data();
      const userToBlockId = userToBlockSnapshot.docs[0].id;

      // Não permitir bloquear a si mesmo
      if (userToBlockId === currentUser.uid) {
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Você não pode bloquear a si mesmo',
          buttons: [
            { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
          ]
        });
        return;
      }

      // Atualizar o documento do usuário logado no Firestore
      const currentUserRef = doc(firestore, 'usuarios', currentUser.uid);
      await updateDoc(currentUserRef, {
        blockedUsers: arrayUnion(userToBlockId)
      });

      // Atualizar o AsyncStorage com a nova lista de usuários bloqueados
      const updatedBlockedUsers = [...(currentUser.blockedUsers || []), userToBlockId];
      const updatedUserData = {
        ...currentUser,
        blockedUsers: updatedBlockedUsers
      };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUserData));

      // Notificar sucesso
      onBlockUser(blockUsername);
      setBlockUsername('');
      onClose();

    } catch (error: any) {
      console.error('Erro ao bloquear usuário:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Erro ao bloquear usuário: ' + error.message,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <TouchableOpacity
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalContent, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>Bloquear Usuário</Text>
          <Text style={[styles.modalSubtitle, { color: themeColors.googleButton }]}>
            Digite o nome do usuário que deseja bloquear para confirmar o bloqueio:
          </Text>
          

          <TouchableOpacity 
            style={[
              styles.floatingUsername,
              { 
                backgroundColor: 'rgba(255,255,255,0.1)',
              }
            ]}
            onPress={() => {
              const parts = selectedUser?.split(' ') || [];
              let currentIndex = 0;
              const interval = setInterval(() => {
                if (currentIndex < parts.length) {
                  setBlockUsername(prev => prev + (prev ? ' ' : '') + parts[currentIndex]);
                  currentIndex++;
                } else {
                  clearInterval(interval);
                }
              }, 200);
            }}
          >
            <Text style={[styles.floatingUsernameText, { color: themeColors.googleButton }]}>
              {selectedUser}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={[
              styles.modalInput,
              { 
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.2)',
              }
            ]}
            value={blockUsername}
            onChangeText={setBlockUsername}
            placeholder="Digite o nome do usuário"
            placeholderTextColor={'rgba(255,255,255,0.5)'}
            autoFocus={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalActionButton, { backgroundColor: themeColors.tint }]}
              onPress={handleConfirmBlock}
            >
              <Text style={[styles.modalActionButtonText, { color: '#fff' }]}>Bloquear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={onClose}
            >
              <Text style={[styles.modalActionButtonText, { color: '#fff' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        buttons={customAlert.buttons}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: Math.min(Dimensions.get('window').width * 0.9, 400),
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  floatingUsername: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 16,
  },
  floatingUsernameText: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BlockUserModal; 