import * as Localization from 'expo-localization';
import i18n from 'i18n-js';

import en from '@/locales/en.json';
import pt from '@/locales/pt.json';

// Certifique-se de que o objeto i18n.translations seja inicializado corretamente
i18n.translations = {
  en,
  pt,
};

// Definir o idioma padrão como o idioma do dispositivo
i18n.locale = Localization.locale || 'en';
i18n.fallbacks = true;

export default i18n;
