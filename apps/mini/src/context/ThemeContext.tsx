import Taro from '@tarojs/taro';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSettings } from './SettingsContext';

type ThemeType = "light" | "dark";

interface ThemeColors {
  background: string;
  text: string;
  primary: string;
  secondary: string;
  card: string;
  border: string;
  tabBar: string;
  tabIconActive: string;
  tabIconInactive: string;
}

const lightColors: ThemeColors = {
  background: "#FFFFFF",
  text: "#000000",
  primary: "#000000",
  secondary: "#666666",
  card: "#F5F5F5",
  border: "#E0E0E0",
  tabBar: "#FFFFFF",
  tabIconActive: "#000000",
  tabIconInactive: "#888888",
};

const darkColors: ThemeColors = {
  background: "#000000",
  text: "#FFFFFF",
  primary: "#FFFFFF",
  secondary: "#AAAAAA",
  card: "#1A1A1A",
  border: "#333333",
  tabBar: "#000000",
  tabIconActive: "#FFFFFF",
  tabIconInactive: "#666666",
};

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  colors: lightColors,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<ThemeType>("light");
  const { autoTheme } = useSettings();

  useEffect(() => {
    if (autoTheme) {
      const systemInfo = Taro.getSystemInfoSync();
      // Use type assertion if 'theme' is not in the type definition, common in MP
      const sysTheme = (systemInfo as any).theme || "light";
      setTheme(sysTheme);
    }
  }, [autoTheme]);

  useEffect(() => {
    if (!autoTheme) {
      loadTheme();
    }
  }, [autoTheme]);

  const loadTheme = async () => {
    try {
      const savedTheme = Taro.getStorageSync("theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error("Failed to load theme:", error);
    }
  };

  const toggleTheme = async () => {
    if (autoTheme) return; // Prevent manual toggle when auto mode is on
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    try {
      Taro.setStorageSync("theme", newTheme);
    } catch (error) {
      console.error("Failed to save theme:", error);
    }
  };

  const colors = theme === "light" ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
