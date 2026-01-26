import { useTheme } from "@/src/context/ThemeContext";
import { Slider } from "@miblanchard/react-native-slider";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AudioEq from "../../modules/audio-eq";
import { getAudioSessionId } from "../utils/TrackPlayerExtension";

const BANDS = [
  { index: 0, label: "60Hz", name: "超低音" },
  { index: 1, label: "230Hz", name: "低音" },
  { index: 2, label: "910Hz", name: "中音" },
  { index: 3, label: "4kHz", name: "高音" },
  { index: 4, label: "14kHz", name: "超高音" },
];

interface EqualizerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [gains, setGains] = useState<number[]>([0, 0, 0, 0, 0]);

  useEffect(() => {
    if (visible) {
      getAudioSessionId().then((sessionId) => {
        if (sessionId > 0) {
          // 挂载 EQ 到这个真实的 SessionId
          const success = AudioEq.initEqualizer(sessionId);
          if (success) {
            console.log("EQ 挂载成功！");
          }
        } else {
          // 如果获取失败，尝试用 0 (全局混音) 兜底，或者是放弃
          // AudioEq.initEqualizer(0);
        }
      });
    }
  }, [visible]);

  const handleGainChange = (bandIndex: number, value: number) => {
    const newGains = [...gains];
    newGains[bandIndex] = value;
    setGains(newGains);
    AudioEq.setGain(bandIndex, value);
  };

  const resetEq = () => {
    const defaultGains = [0, 0, 0, 0, 0];
    setGains(defaultGains);
    defaultGains.forEach((gain, index) => {
      AudioEq.setGain(index, gain);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={{ width: "100%", maxWidth: 450, alignSelf: "center" }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.card,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                均衡器 (EQ)
              </Text>
              <TouchableOpacity onPress={resetEq}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>
                  重置
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bandsContainer}>
              {BANDS.map((band) => (
                <View key={band.index} style={styles.bandColumn}>
                  <Text style={[styles.dbText, { color: colors.text }]}>
                    {gains[band.index]}dB
                  </Text>

                  <View style={styles.sliderWrapper}>
                    <Slider
                      containerStyle={styles.slider}
                      minimumValue={-10}
                      maximumValue={10}
                      step={1}
                      value={gains[band.index]}
                      onValueChange={(val) =>
                        handleGainChange(
                          band.index,
                          Array.isArray(val) ? val[0] : val,
                        )
                      }
                      minimumTrackTintColor={colors.primary}
                      maximumTrackTintColor={colors.border}
                      renderThumbComponent={() => (
                        <View
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 8,
                            backgroundColor: colors.primary,
                            borderWidth: 2,
                            borderColor: "#fff",
                          }}
                        />
                      )}
                    />
                  </View>

                  <Text style={[styles.freqLabel, { color: colors.secondary }]}>
                    {band.label}
                  </Text>
                  <Text style={[styles.bandName, { color: colors.secondary }]}>
                    {band.name}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={[styles.closeButtonText, { color: colors.background }]}>完成</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    width: "100%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(150,150,150,0.3)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  bandsContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    height: 280,
    paddingHorizontal: 10,
  },
  bandColumn: {
    alignItems: "center",
    width: 70,
  },
  sliderWrapper: {
    height: 180,
    width: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  slider: {
    width: 160,
    height: 40,
    transform: [{ rotate: "-90deg" }],
  },
  dbText: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: "600",
  },
  freqLabel: {
    fontSize: 12,
    marginTop: 10,
    fontWeight: "500",
  },
  bandName: {
    fontSize: 10,
    marginTop: 2,
  },
  closeButton: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
