import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Função para calcular o CRC16 (equivalente ao crcmod com poly=0x11021, init=0xFFFF, xorOut=0x0000)
const crc16 = (buf) => {
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

const PixQRCode = ({ trabalho, usuario }) => {
  // Dados provenientes do "banco de dados" ou API
  // Exemplo: trabalho.pago e usuario.chave_pix
  const nome = "Socorro";
  const chave = String(usuario.chave_pix); // Valor da chave PIX
  const valor = parseFloat(trabalho.pago).toFixed(2);
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
    <View>
      <QRCode
        value={payloadPronta}
        size={200} // Tamanho do QR Code (pode ser ajustado)
      />
    </View>
  );
};

export default PixQRCode;
