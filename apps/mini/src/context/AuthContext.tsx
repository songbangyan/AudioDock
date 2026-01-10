import { login as loginApi, register as registerApi } from '@soundx/services'
import Taro from '@tarojs/taro'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '../models'
import { setBaseURL } from '../utils/request'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (user: Partial<User>) => Promise<void>
  register: (user: Partial<User>) => Promise<void>
  logout: () => Promise<void>
  device: any | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  device: null,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [device, setDevice] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAuthData()
  }, [])

  const loadAuthData = async () => {
    try {
      const serverAddress = Taro.getStorageSync('serverAddress')
      if (serverAddress) {
        setBaseURL(serverAddress)
      }

      const savedToken = Taro.getStorageSync('token')
      const savedUser = Taro.getStorageSync('user')
      const savedDevice = Taro.getStorageSync('device')

      if (savedToken) {
        setToken(savedToken)
      }
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
      if (savedDevice) {
        setDevice(JSON.parse(savedDevice))
      }
    } catch (error) {
      console.error('Failed to load auth data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: Partial<User>) => {
    try {
      const res = await loginApi({ ...credentials })
      if (res.code === 200 && res.data) {
        console.log(res, 'res')
        const { token: newToken, device: newDevice } = res.data
        const userData = res.data
        setToken(newToken)
        setUser(userData)
        Taro.setStorageSync('token', newToken);
        Taro.setStorageSync('user', JSON.stringify(userData))
        if (newDevice) {
          setDevice(newDevice)
          Taro.setStorageSync('device', JSON.stringify(newDevice))
        }
      } else {
        throw new Error(res.message || 'Login failed')
      }
    } catch (error) {
      throw error
    }
  }

  const register = async (credentials: Partial<User>) => {
    try {
      const res = await registerApi({ ...credentials })
      if (res.code === 200 && res.data) {
        const { token: newToken, device: newDevice } = res.data
        const userData = res.data
        setToken(newToken)
        setUser(userData)
        Taro.setStorageSync('token', newToken)
        Taro.setStorageSync('user', JSON.stringify(userData))
        if (newDevice) {
          setDevice(newDevice)
          Taro.setStorageSync('device', JSON.stringify(newDevice))
        }
      } else {
        throw new Error(res.message || 'Registration failed')
      }
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      setToken(null)
      setUser(null)
      setDevice(null)
      Taro.removeStorageSync('token')
      Taro.removeStorageSync('user')
      Taro.removeStorageSync('device')
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, device }}
    >
      {children}
    </AuthContext.Provider>
  )
}
