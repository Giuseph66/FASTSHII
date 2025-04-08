import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import PixQRCode from './pix'; // Certifique-se de ajustar o caminho conforme necessário

const PixScreen = () => {
  // Exemplo de dados que podem vir de uma API ou estado global
  const trabalho = { pago: 150.50 };
  const usuario = { chave_pix: '+5566999086599' };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>QR Code PIX</Text>
      <View style={styles.qrContainer}>
        <PixQRCode trabalho={trabalho} usuario={usuario} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: 'bold',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 10,
    elevation: 5, // Sombra para Android
    shadowColor: '#000', // Sombra para iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});

export default PixScreen;
