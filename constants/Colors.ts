/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#151142';
const tintColorDark = '#ff5500';

export const Colors = {
  light: {
    text: '#000', // Black text
    background: '#FFFFFF', // White background
    tint: tintColorLight, // Light theme accent color
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    googleButton: '#000',
  },
  dark: {
    text: '#000', // Light text
    background: '#151718', // Dark background
    tint: tintColorDark, // Dark theme accent color
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    googleButton: '#fff',
  },
};
