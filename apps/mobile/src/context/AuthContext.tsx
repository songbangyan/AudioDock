import AsyncStorage from "@react-native-async-storage/async-storage";
import { login as loginApi, register as registerApi } from "@soundx/services";
import * as Device from 'expo-device';
import React, { createContext, useContext, useEffect, useState } from "react";
import { getBaseURL, initBaseURL, setBaseURL } from "../https";
import { User } from "../models";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: Partial<User>) => Promise<void>;
  register: (user: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  device: any | null;
  switchServer: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  device: null,
  switchServer: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [device, setDevice] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      await initBaseURL(); // Initialize base URL first
      const savedAddress = getBaseURL();
      
      const savedToken = await AsyncStorage.getItem(`token_${savedAddress}`);
      const savedUser = await AsyncStorage.getItem(`user_${savedAddress}`);

      if (savedToken) {
        setToken(savedToken);
      }
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      const savedDevice = await AsyncStorage.getItem(`device_${savedAddress}`);
      if (savedDevice) {
        setDevice(JSON.parse(savedDevice));
      }
    } catch (error) {
      console.error("Failed to load auth data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: Partial<User>) => {
    try {
      const deviceName = Device.modelName || 'Mobile Device';
      const res = await loginApi({ ...credentials, deviceName });
      if (res.code === 200 && res.data) {
        const { token: newToken, device, ...userData } = res.data;
        const savedAddress = getBaseURL();
        
        setToken(newToken);
        setUser(userData);
        await AsyncStorage.setItem(`token_${savedAddress}`, newToken);
        await AsyncStorage.setItem(`user_${savedAddress}`, JSON.stringify(userData));
        if (device) {
          setDevice(device);
          await AsyncStorage.setItem(`device_${savedAddress}`, JSON.stringify(device));
        }
      } else {
        throw new Error(res.message || "Login failed");
      }
    } catch (error) {
      throw error;
    }
  };

  const register = async (credentials: Partial<User>) => {
    try {
      const deviceName = Device.modelName || 'Mobile Device';
      const res = await registerApi({ ...credentials, deviceName });
      if (res.code === 200 && res.data) {
        const { token: newToken, device, ...userData } = res.data;
        const savedAddress = getBaseURL();

        setToken(newToken);
        setUser(userData);
        await AsyncStorage.setItem(`token_${savedAddress}`, newToken);
        await AsyncStorage.setItem(`user_${savedAddress}`, JSON.stringify(userData));
        if (device) {
          setDevice(device);
          await AsyncStorage.setItem(`device_${savedAddress}`, JSON.stringify(device));
        }
      } else {
        throw new Error(res.message || "Registration failed");
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      const savedAddress = getBaseURL();
      setToken(null);
      setUser(null);
      setDevice(null);
      await AsyncStorage.removeItem(`token_${savedAddress}`);
      await AsyncStorage.removeItem(`user_${savedAddress}`);
      await AsyncStorage.removeItem(`device_${savedAddress}`);
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const switchServer = async (url: string) => {
    try {
      setIsLoading(true);
      await AsyncStorage.setItem("serverAddress", url);
      setBaseURL(url);
      
      const savedToken = await AsyncStorage.getItem(`token_${url}`);
      const savedUser = await AsyncStorage.getItem(`user_${url}`);
      const savedDevice = await AsyncStorage.getItem(`device_${url}`);

      setToken(savedToken || null);
      setUser(savedUser ? JSON.parse(savedUser) : null);
      setDevice(savedDevice ? JSON.parse(savedDevice) : null);
    } catch (error) {
      console.error("Failed to switch server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, device, switchServer }}
    >
      {children}
    </AuthContext.Provider>
  );
};
