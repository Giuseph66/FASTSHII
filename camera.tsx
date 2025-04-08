import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { firestore } from '@/firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export default function App() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  if (!permission) {
    // As permissões da câmera ainda estão carregando.
    return <View />;
  }

  if (!permission.granted) {
    // As permissões da câmera ainda não foram concedidas.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Precisamos da sua permissão para mostrar a câmera</Text>
        <Button onPress={requestPermission} title="Conceder permissão" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  async function tirarFoto() {
    if (cameraRef.current) {
      const foto = await cameraRef.current.takePictureAsync();

      try {
        console.log('Comprimindo a foto...');
        const fotoComprimida = await ImageManipulator.manipulateAsync(
          foto.uri,
          [{ resize: { width: 800 } }], // Redimensiona a largura para 800px
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Comprime a imagem
        );

        console.log('Convertendo a foto para Base64...');
        const fotoBase64 = await FileSystem.readAsStringAsync(fotoComprimida.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log('Salvando a foto no Firestore...');
        const fotoData = {
          base64: fotoBase64,
          timestamp: Date.now(),
        };

        const docRef = await addDoc(collection(firestore, 'fotos'), fotoData);
        console.log('Foto salva no Firestore com ID:', docRef.id);

        Alert.alert('Sucesso', 'Foto salva com sucesso!');
      } catch (error) {
        console.error('Erro ao salvar foto no Firestore:', error.message);
        Alert.alert('Erro', 'Erro ao salvar foto: ' + error.message);
      }
    }
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
            <Text style={styles.text}>Trocar Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={tirarFoto}>
            <Text style={styles.text}>Tirar Foto</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
