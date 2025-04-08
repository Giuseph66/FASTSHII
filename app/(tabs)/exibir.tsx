import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Modal, TouchableOpacity, Button } from 'react-native';
import { firestore } from '@/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export default function ExibirFotos() {
  const [fotos, setFotos] = useState<string[]>([]);
  const [imagemSelecionada, setImagemSelecionada] = useState<string | null>(null);

  async function carregarFotos() {
    try {
      const fotosRef = collection(firestore, 'fotos');
      const querySnapshot = await getDocs(fotosRef);

      const base64Fotos = querySnapshot.docs.map(doc => `data:image/jpeg;base64,${doc.data().base64}`);
      setFotos(base64Fotos);
    } catch (error) {
      console.error('Erro ao carregar fotos do Firestore:', error);
    }
  }

  useEffect(() => {
    carregarFotos();
  }, []);

  function renderizarFoto({ item }: { item: string }) {
    return (
      <TouchableOpacity onPress={() => setImagemSelecionada(item)}>
        <Image source={{ uri: item }} style={styles.imagem} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Fotos Salvas no Firestore</Text>
      <Button title="Recarregar Fotos" onPress={carregarFotos} color="#FFA500" />
      {fotos.length === 0 ? (
        <Text style={styles.mensagem}>Nenhuma foto encontrada.</Text>
      ) : (
        <FlatList
          data={fotos}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderizarFoto}
        />
      )}

      {/* Modal para exibir a imagem em tela cheia */}
      <Modal visible={!!imagemSelecionada} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setImagemSelecionada(null)}>
            <Text style={styles.modalCloseText}>Fechar</Text>
          </TouchableOpacity>
          {imagemSelecionada && (
            <Image source={{ uri: imagemSelecionada }} style={styles.imagemFull} />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  mensagem: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  imagem: {
    width: '100%',
    height: 200,
    marginBottom: 16,
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagemFull: {
    width: '90%',
    height: '80%',
    resizeMode: 'contain',
  },
});
