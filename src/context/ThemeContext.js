import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@quran_wird_theme_mode';

export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

const lightColors = {
  bgPrimary: '#064E3B',
  bgPage: '#F4FBF7',
  bgCard: '#FFFFFF',
  bgSubtle: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textHeader: '#FFFFFF',
  border: '#E2E8F0',
  cardBorder: '#D1FAE5',
  accent: '#059669',
  accentLight: '#ECFDF5',
  gold: '#D97706',
  goldBg: '#FEF3C7',
  goldBorder: '#F59E0B',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  statusReadBg: '#D1FAE5',
  statusReadText: '#065F46',
  statusPendingBg: '#FEF3C7',
  statusPendingText: '#92400E',
  statusExcusedBg: '#E0E7FF',
  statusExcusedText: '#3730A3',
};

const darkColors = {
  bgPrimary: '#04221A',
  bgPage: '#0A101D',
  bgCard: '#131D2D',
  bgSubtle: '#182438',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textHeader: '#F8FAFC',
  border: '#1E293B',
  cardBorder: '#1E3A34',
  accent: '#10B981',
  accentLight: '#064E3B',
  gold: '#FBBF24',
  goldBg: '#2D2313',
  goldBorder: '#B45309',
  danger: '#F87171',
  dangerBg: '#3E1818',
  statusReadBg: '#064E3B',
  statusReadText: '#A7F3D0',
  statusPendingBg: '#3F2806',
  statusPendingText: '#FDE68A',
  statusExcusedBg: '#1E1B4B',
  statusExcusedText: '#C7D2FE',
};

const ThemeContext = createContext({
  themeMode: THEME_MODES.SYSTEM,
  setThemeMode: () => {},
  isDark: false,
  colors: lightColors,
});

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState(THEME_MODES.SYSTEM);

  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved && Object.values(THEME_MODES).includes(saved)) {
        setThemeModeState(saved);
      }
    } catch (_e) {}
  };

  const setThemeMode = async (mode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_e) {}
  };

  const isDark =
    themeMode === THEME_MODES.DARK ||
    (themeMode === THEME_MODES.SYSTEM && systemColorScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
