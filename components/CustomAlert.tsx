import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';

interface CustomAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title?: string;
  message: string;
  buttons?: CustomAlertButton[];
  onRequestClose?: () => void;
}

const { width } = Dimensions.get('window');

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onRequestClose,
}) => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: themeColors.background, borderColor: themeColors.tint }]}> 
          {title && <Text style={[styles.title, { color: themeColors.tint }]}>{title}</Text>}
          <Text style={[styles.message, { color: themeColors.googleButton }]}>{message}</Text>
          <View style={styles.buttonRow}>
            {buttons.map((btn, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.button,
                  btn.style === 'cancel' && { backgroundColor: themeColors.icon },
                  btn.style === 'destructive' && { backgroundColor: '#ffdddd' },
                  btn.style === 'default' && { backgroundColor: themeColors.tint },
                ]}
                onPress={btn.onPress}
              >
                <Text
                  style={[
                    styles.buttonText,
                    btn.style === 'cancel' && { color: themeColors.googleButton },
                    btn.style === 'destructive' && { color: '#d00' },
                    btn.style === 'default' && { color: '#fff' },
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.8,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginLeft: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CustomAlert; 