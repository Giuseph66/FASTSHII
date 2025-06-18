/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Background } from "@react-navigation/elements";

const tintColorLight = '#151142';
const tintColorDark = '#ff5500';

export const Colors = {
  light: {
    text: '#000', // Black text
    textSearch: '#000',
    textSeguir: '#fff',
    background: '#FFFFFF', // White background
    backgroundfraco : 'rgba(0, 0, 0, 0.17)',
    backgroundfundoemoji : 'rgba(0, 50, 116, 0.74)',
    tint: tintColorLight, // Light theme accent color
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    googleButton: '#000',
    botaolike: '#000',
    transparente: 'rgba(0, 0, 0, 0)',
  },
  dark: {
    text: '#000', // Light text
    textSearch: '#fff',
    textSeguir: '#000',
    background: '#151718', // Dark background
    backgroundfraco : 'rgba(255,255,255,0.05)',
    backgroundfundoemoji : 'rgba(161, 62, 4, 0.66)',
    tint: tintColorDark, // Dark theme accent color
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    googleButton: '#fff',
    botaolike: '#fff',
    transparente: 'rgba(0, 0, 0, 0)',
  },
};
