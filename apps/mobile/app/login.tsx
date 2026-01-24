import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SOURCEMAP,
  SOURCETIPSMAP
} from "@soundx/services";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
const logo = require("../assets/images/logo.png");
const subsonicLogo = require("../assets/images/subsonic.png");
const embyLogo = require("../assets/images/emby.png");

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, register, switchServer, sourceType: authSourceType } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [serverAddress, setServerAddress] = useState("http://localhost:3000");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<"ok" | "error">("error");
  const [sourceType, setSourceType] = useState<string>("AudioDock");

  useEffect(() => {
    if (authSourceType) {
      setSourceType(authSourceType);
    }
  }, [authSourceType]);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    loadServerAddress(sourceType);
  }, [sourceType]);

  const checkServerConnectivity = async (address: string) => {
    if (!address) {
      setStatusMessage("error");
      return;
    }

    // Simple URL validation
    if (!address.startsWith("http://") && !address.startsWith("https://")) {
      setStatusMessage("error");
      return;
    }

    const mappedType =
      SOURCEMAP[sourceType as keyof typeof SOURCEMAP] || "audiodock";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Determine the ping URL based on source type
      const pingUrl = mappedType === "subsonic"
        ? `${address.replace(/\/+$/, "")}/rest/ping.view?v=1.16.1&c=SoundX&f=json`
        : `${address.replace(/\/+$/, "")}/hello`;

      const response = await fetch(pingUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      // For Subsonic, a 401 also means the server is alive (just needs auth)
      // For Native, we check /hello which should be public
      if (response.ok || (mappedType === "subsonic" && response.status === 401)) {
        setStatusMessage("ok");
        restoreCredentials(address, sourceType);
      } else {
        setStatusMessage("error");
      }
    } catch (error) {
      setStatusMessage("error");
    }
  };

  const restoreCredentials = async (address: string, type: string) => {
    try {
      const credsKey = `creds_${type}_${address}`;
      const savedCreds = await AsyncStorage.getItem(credsKey);
      if (savedCreds) {
        const { username: u, password: p } = JSON.parse(savedCreds);
        setUsername(u || "");
        setPassword(p || "");
      } else {
        setUsername("");
        setPassword("");
      }
    } catch (e) {
      console.error("Failed to restore credentials", e);
    }
  };

  const loadServerAddress = async (type: string) => {
    try {
      const addressKey = `serverAddress_${type}`;
      const historyKey = `serverHistory_${type}`;

      const savedAddress = await AsyncStorage.getItem(addressKey);
      const savedHistory = await AsyncStorage.getItem(historyKey);

      let historyItems =
        type === "AudioDock"
          ? [{ label: "http://localhost:3000", value: "http://localhost:3000" }]
          : [];

      if (savedHistory) {
        historyItems = JSON.parse(savedHistory);
      }

      setItems(historyItems);

      if (savedAddress) {
        setServerAddress(savedAddress);
        restoreCredentials(savedAddress, type);
      } else {
        setServerAddress(type === "AudioDock" ? "http://localhost:3000" : "");
        setUsername("");
        setPassword("");
        setStatusMessage("error");
      }
    } catch (error) {
      console.error("Failed to load server address:", error);
    }
  };

  const saveToHistory = async (address: string, type: string) => {
    if (!address) return;
    try {
      const historyKey = `serverHistory_${type}`;
      const currentHistory = await AsyncStorage.getItem(historyKey);
      let history = currentHistory ? JSON.parse(currentHistory) : [];

      if (!history.find((item: any) => item.value === address)) {
        history.push({ label: address, value: address });
        await AsyncStorage.setItem(historyKey, JSON.stringify(history));
        setItems(history);
      }
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  };

  const handleDeleteHistory = async (address: string) => {
    try {
      const historyKey = `serverHistory_${sourceType}`;
      const currentHistory = await AsyncStorage.getItem(historyKey);
      if (currentHistory) {
        let history = JSON.parse(currentHistory);
        history = history.filter((item: any) => item.value !== address);
        await AsyncStorage.setItem(historyKey, JSON.stringify(history));
        setItems(history);
        if (serverAddress === address) {
          setServerAddress("");
          setStatusMessage("error");
        }
      }
    } catch (error) {
      console.error("Failed to delete history:", error);
    }
  };

  const handleSubmit = async () => {
    if (!serverAddress) {
      Alert.alert("Error", "Please enter server address");
      return;
    }
    if (!username || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    // Registration check skipped for Subsonic as it throws "Not supported"
      console.log("handleSubmit", serverAddress, username, password);
    try {
      setLoading(true);
      
      const credsKey = `creds_${sourceType}_${serverAddress}`;

      // 1. Save all configurations to storage first
      await AsyncStorage.setItem(credsKey, JSON.stringify({ username, password }));
      await saveToHistory(serverAddress, sourceType);
      
      // 2. Use the unified switchServer logic to update baseURL, adapter and service config
      // This ensures that the next request (login/register) goes to the correct server with correct adapter
      await switchServer(serverAddress, sourceType);

      // 3. Perform login or registration
      const mappedType = SOURCEMAP[sourceType as keyof typeof SOURCEMAP] || "audiodock";
      if (isLogin) {
        await login({ username, password });
      } else {
        if (mappedType === "subsonic") {
          throw new Error("Subsonic sourcing does not support registration");
        }
        await register({ username, password });
      }
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isLogin ? "欢迎登录" : "欢迎注册"}
            </Text>

            <View style={styles.form}>
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 10,
                }}
              >
                {Object.keys(SOURCEMAP).map((key) => {
                  const isActive = sourceType === key;
                  const isDisabled = key === "Emby";
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => !isDisabled && setSourceType(key)}
                      disabled={isDisabled}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        alignItems: "center",
                        backgroundColor: isActive
                          ? colors.background
                          : "transparent",
                        borderRadius: 8,
                        opacity: isDisabled ? 0.5 : 1,
                        // Shadow for active item
                        ...(isActive && {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2,
                        }),
                      }}
                    >
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        {key === "Emby" ? (
                          <Image
                            source={embyLogo}
                            style={{ width: 20, height: 20, marginRight: 6 }}
                          />
                        ) : key === "Subsonic" ? (
                          <Image
                            source={subsonicLogo}
                            style={{ width: 20, height: 20, marginRight: 6 }}
                          />
                        ) : (
                          <Image
                            source={logo}
                            style={{ width: 20, height: 20, marginRight: 6 }}
                          />
                        )}
                        <Text
                          style={{
                            color: isActive ? colors.primary : colors.secondary,
                            fontWeight: isActive ? "bold" : "normal",
                            fontSize: 14,
                          }}
                        >
                          {key}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={{
                  color: colors.secondary,
                  fontSize: 12,
                  marginBottom: 10,
                }}
              >
                {SOURCETIPSMAP[sourceType as keyof typeof SOURCETIPSMAP]}
              </Text>

              <Text style={[styles.label, { color: colors.text }]}>
                数据源地址
              </Text>
              <View style={[styles.inputContainer, { zIndex: 1000 }]}>
                <View style={styles.inputWarp}>
                  <DropDownPicker
                    open={open}
                    value={serverAddress}
                    items={items}
                    setOpen={setOpen}
                    setValue={setServerAddress}
                    setItems={setItems}
                    searchable={true}
                    searchPlaceholder="输入数据源地址..."
                    searchTextInputProps={{
                      autoCapitalize: "none",
                    }}
                    placeholder="选择或输入数据源地址"
                    addCustomItem={true}
                    onChangeValue={(value) => {
                      if (value) checkServerConnectivity(value as string);
                    }}
                    theme={colors.background === "#000000" ? "DARK" : "LIGHT"}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                    dropDownContainerStyle={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                    textStyle={{
                      color: colors.text,
                    }}
                    placeholderStyle={{
                      color: colors.secondary,
                    }}
                    listMode="SCROLLVIEW"
                    onSelectItem={(item) => {
                      if (item.value) {
                        checkServerConnectivity(item.value as string);
                      }
                    }}
                    renderListItem={({ item, isSelected }) => {
                      // Only show delete button for items that are in our saved history
                      const isPersistent = items.some(
                        (i) => i.value === item.value,
                      );

                      return (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 10,
                            borderBottomWidth: 0.5,
                            borderBottomColor: colors.border,
                            backgroundColor: isSelected
                              ? "rgba(150,150,150,0.1)"
                              : "transparent",
                          }}
                        >
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                            }}
                            onPress={() => {
                              // Perform the selection logic
                              const value = item.value as string;
                              if (value) {
                                setServerAddress(value);
                                checkServerConnectivity(value);

                                // For custom items (not in history), save them
                                if (!isPersistent) {
                                  saveToHistory(value, sourceType);
                                }
                              }

                              // Call library's onPress to handle internal state
                              // onPress(value as any);
                              setOpen(false);
                            }}
                          >
                            <Text style={{ color: colors.text, flex: 1 }}>
                              {item.label}
                            </Text>
                            {isSelected && (
                              <FontAwesome
                                name="check-circle"
                                size={16}
                                color={colors.primary}
                              />
                            )}
                          </TouchableOpacity>
                          {isPersistent && !item.parent && (
                            <TouchableOpacity
                              style={{ padding: 5, marginLeft: 10 }}
                              onPress={() =>
                                handleDeleteHistory(item.value as string)
                              }
                            >
                              <MaterialIcons
                                name="delete-outline"
                                size={20}
                                color={colors.secondary}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    }}
                  />
                </View>
                {statusMessage === "error" ? (
                  <MaterialIcons
                    style={styles.statusMessage}
                    name="error"
                    size={24}
                    color="red"
                  />
                ) : (
                  <FontAwesome
                    style={styles.statusMessage}
                    name="check-circle"
                    size={24}
                    color={colors.primary}
                  />
                )}
              </View>

              <Text style={[styles.label, { color: colors.text }]}>用户名</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                placeholder="用户名"
                placeholderTextColor={colors.secondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.text }]}>密码</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                placeholder="密码"
                placeholderTextColor={colors.secondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {!isLogin && (
                <>
                  <Text style={[styles.label, { color: colors.text }]}>
                    确认密码
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                    ]}
                    placeholder="确认密码"
                    placeholderTextColor={colors.secondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text
                    style={[styles.buttonText, { color: colors.background }]}
                  >
                    {isLogin ? "登陆" : "注册"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text style={[styles.switchText, { color: colors.secondary }]}>
                  {sourceType === "AudioDock"
                    ? isLogin
                      ? "没有账号？注册"
                      : "已有账号？登录"
                    : "AudioDock 听见你的声音"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
    textAlign: "center",
  },
  form: {
    width: "100%",
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 20,
    alignItems: "center",
  },
  switchText: {
    fontSize: 14,
  },
  statusMessage: {},
  inputContainer: {
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  inputWarp: {
    flex: 4,
  },
});
