import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

interface Usuario {
  chave_pix: string;
}

interface Trabalho {
  pago: number;
}

interface SystemSettings {
  dailyCoffeeLimit: number;
  minTimeBetweenCoffees: number;
  subscriptionPrices: {
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  maintenanceMode: boolean;
  welcomeMessage: string;
  serverUrl: string;
  pixKey: string;
  [key: string]: any;
}

interface PixQRCodeProps {
  trabalho: Trabalho;
  usuario: Usuario;
}

// Função para calcular o CRC16 (equivalente ao crcmod com poly=0x11021, init=0xFFFF, xorOut=0x0000)
const crc16 = (buf: Uint8Array): number => {
  let crc = 0xFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
};

const PixQRCode: React.FC<PixQRCodeProps> = ({ trabalho, usuario }) => {
  const nome = "CAFEZAO DA COMPUTACAOO";
  const chave = String(usuario.chave_pix); // Usar a chave PIX do contexto se não for fornecida
  const valor = parseFloat(trabalho.pago.toString()).toFixed(2);
  const cidade = "SINOP_MT";
  const txt = "LOJA01";

  // Constantes fixas do payload
  const payloadFormato = "000201";
  const merchantCategoria = "52040000";
  const transationCurrect = "5303986";
  const contraCode = "5802BR";

  // Cálculo dos tamanhos
  const nomeLength = nome.length;
  const chaveLength = chave.length;
  const valorLength = valor.length;
  const cidadeLength = cidade.length;
  const txtLength = txt.length;

  // Monta merchantAccont
  const merchantAccont_tam = "0014BR.GOV.BCB.PIX01" + chaveLength + chave;
  const merchantAccont = "26" + String(merchantAccont_tam.length) + merchantAccont_tam;
  const transationAmount_valor_tam = "0" + valorLength + valor;

  // Monta Data_tam conforme o tamanho de txt
  const Data_tam = txtLength <= 9
    ? "050" + txtLength + txt
    : "05" + txtLength + txt;

  // Formata os tamanhos de nome e cidade
  const nomeLengthFormatted = nomeLength <= 9 ? "0" + nomeLength : String(nomeLength);
  const cidadeLengthFormatted = cidadeLength <= 9 ? "0" + cidadeLength : String(cidadeLength);

  const transationAmount_valor = "54" + transationAmount_valor_tam;
  const merchant_Nome = "59" + nomeLengthFormatted + nome;
  const city = "60" + cidadeLengthFormatted + cidade;
  const Data = "62" + String(Data_tam.length) + Data_tam;
  const crc16Tag = "6304";

  // Monta o payload sem o CRC
  const payload =
    payloadFormato +
    merchantAccont +
    merchantCategoria +
    transationCurrect +
    transationAmount_valor +
    contraCode +
    merchant_Nome +
    city +
    Data +
    crc16Tag;

  // Converte o payload para bytes e calcula o CRC16
  const textEncoder = new TextEncoder();
  const payloadBytes = textEncoder.encode(payload);
  let crcValue = crc16(payloadBytes);
  let crcHex = crcValue.toString(16).toUpperCase();
  crcHex = crcHex.padStart(4, '0');

  // Payload final com CRC
  const payloadPronta = payload + crcHex;

  return (
    <View style={styles.container}>
      <QRCode
        value={payloadPronta}
        size={200}
        backgroundColor="white"
        color="black"
      />
    </View>
  );
};

export const getPayloadPronta = (trabalho: Trabalho, usuario: Usuario) => {
  const nome = "CAFEZAO DA COMPUTACAOO";
  const chave = String(usuario.chave_pix);
  const valor = parseFloat(trabalho.pago.toString()).toFixed(2);
  const cidade = "SINOP_MT";
  const txt = "LOJA01";

  // Constantes fixas do payload
  const payloadFormato = "000201";
  const merchantCategoria = "52040000";
  const transationCurrect = "5303986";
  const contraCode = "5802BR";

  // Cálculo dos tamanhos
  const nomeLength = nome.length;
  const chaveLength = chave.length;
  const valorLength = valor.length;
  const cidadeLength = cidade.length;
  const txtLength = txt.length;

  // Monta merchantAccont
  const merchantAccont_tam = "0014BR.GOV.BCB.PIX01" + chaveLength + chave;
  const merchantAccont = "26" + String(merchantAccont_tam.length) + merchantAccont_tam;
  const transationAmount_valor_tam = "0" + valorLength + valor;

  // Monta Data_tam conforme o tamanho de txt
  const Data_tam = txtLength <= 9
    ? "050" + txtLength + txt
    : "05" + txtLength + txt;

  // Formata os tamanhos de nome e cidade
  const nomeLengthFormatted = nomeLength <= 9 ? "0" + nomeLength : String(nomeLength);
  const cidadeLengthFormatted = cidadeLength <= 9 ? "0" + cidadeLength : String(cidadeLength);

  const transationAmount_valor = "54" + transationAmount_valor_tam;
  const merchant_Nome = "59" + nomeLengthFormatted + nome;
  const city = "60" + cidadeLengthFormatted + cidade;
  const Data = "62" + String(Data_tam.length) + Data_tam;
  const crc16Tag = "6304";

  // Monta o payload sem o CRC
  const payload =
    payloadFormato +
    merchantAccont +
    merchantCategoria +
    transationCurrect +
    transationAmount_valor +
    contraCode +
    merchant_Nome +
    city +
    Data +
    crc16Tag;

  // Converte o payload para bytes e calcula o CRC16
  const textEncoder = new TextEncoder();
  const payloadBytes = textEncoder.encode(payload);
  let crcValue = crc16(payloadBytes);
  let crcHex = crcValue.toString(16).toUpperCase();
  crcHex = crcHex.padStart(4, '0');

  // Payload final com CRC
  return payload + crcHex;
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    alignItems: 'center',
  },
  copyCode: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  pixCode: {
    marginTop: 8,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    width: '100%',
  },
});

export default PixQRCode;
