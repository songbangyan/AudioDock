import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addAlbumToHistory,
  addToHistory,
  getLatestHistory,
  reportAudiobookProgress,
} from "@soundx/services";
import * as Device from "expo-device";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
  State,
  useProgress,
  useTrackPlayerEvents,
} from "react-native-track-player";
import { Track, TrackType } from "../models";
import { socketService } from "../services/socket";
import { resolveArtworkUri, resolveTrackUri } from "../services/trackResolver";
import { usePlayMode } from "../utils/playMode";
import { useAuth } from "./AuthContext";
import { useNotification } from "./NotificationContext";
import { useSettings } from "./SettingsContext";
import { useSync } from "./SyncContext";

export enum PlayMode {
  SEQUENCE = "SEQUENCE",
  LOOP_LIST = "LOOP_LIST",
  SHUFFLE = "SHUFFLE",
  LOOP_SINGLE = "LOOP_SINGLE",
  SINGLE_ONCE = "SINGLE_ONCE",
}

interface PlayerContextType {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  isLoading: boolean;
  playTrack: (track: Track, initialPosition?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  trackList: Track[];
  playTrackList: (tracks: Track[], index: number) => Promise<void>;
  playMode: PlayMode;
  togglePlayMode: () => void;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  isSynced: boolean;
  sessionId: string | null;
  handleDisconnect: () => void;
  showPlaylist: boolean;
  setShowPlaylist: (show: boolean) => void;
  sleepTimer: number | null;
  setSleepTimer: (minutes: number) => void;
  clearSleepTimer: () => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => Promise<void>;

  // ✨ 新增：跳过片头/片尾全局配置
  skipIntroDuration: number;
  setSkipIntroDuration: (seconds: number) => void;
  skipOutroDuration: number;
  setSkipOutroDuration: (seconds: number) => void;
}

const PlayerContext = createContext<PlayerContextType>({
  isPlaying: false,
  currentTrack: null,
  position: 0,
  duration: 0,
  isLoading: false,
  playTrack: async () => {},
  pause: async () => {},
  resume: async () => {},
  seekTo: async () => {},
  trackList: [],
  playTrackList: async () => {},
  playMode: PlayMode.SEQUENCE,
  togglePlayMode: () => {},
  playNext: async () => {},
  playPrevious: async () => {},
  isSynced: false,
  sessionId: null,
  handleDisconnect: () => {},
  showPlaylist: false,
  setShowPlaylist: () => {},
  sleepTimer: null,
  setSleepTimer: () => {},
  clearSleepTimer: () => {},
  playbackRate: 1,
  setPlaybackRate: async () => {},
  // ✨ 默认值
  skipIntroDuration: 0,
  setSkipIntroDuration: () => {},
  skipOutroDuration: 0,
  setSkipOutroDuration: () => {},
});

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, device, isLoading: isAuthLoading } = useAuth();
  const { mode } = usePlayMode();
  const { showNotification } = useNotification();
  const { acceptRelay, cacheEnabled } = useSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [trackList, setTrackList] = useState<Track[]>([]);
  const [playMode, setPlayMode] = useState<PlayMode>(PlayMode.SEQUENCE);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sleepTimer, setSleepTimerState] = useState<number | null>(null);
  const [playbackRate, setPlaybackRateState] = useState(1);

  // ✨ 新增 State
  const [skipIntroDuration, setSkipIntroDurationState] = useState(0);
  const [skipOutroDuration, setSkipOutroDurationState] = useState(0);
  const isSkippingOutroRef = useRef(false); // 防止重复触发切歌

  const prevModeRef = useRef(mode);
  const isInitialLoadRef = useRef(true);

  // Hook for progress
  const { position, duration } = useProgress();

  // Refs for accessing latest state in callbacks
  const playModeRef = React.useRef(playMode);
  const trackListRef = React.useRef(trackList);
  const currentTrackRef = React.useRef(currentTrack);
  const positionRef = React.useRef(position);
  const playbackRateRef = React.useRef(playbackRate);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    trackListRef.current = trackList;
  }, [trackList]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  // ✨ 加载本地存储的跳过设置
  useEffect(() => {
    const loadSkipSettings = async () => {
      try {
        const intro = await AsyncStorage.getItem("skipIntroDuration");
        const outro = await AsyncStorage.getItem("skipOutroDuration");
        if (intro) setSkipIntroDurationState(parseInt(intro, 10));
        if (outro) setSkipOutroDurationState(parseInt(outro, 10));
      } catch (e) {
        console.error("Failed to load skip settings", e);
      }
    };
    loadSkipSettings();
  }, []);

  // ✨ 封装 Setter 并持久化
  const setSkipIntroDuration = async (seconds: number) => {
    setSkipIntroDurationState(seconds);
    await AsyncStorage.setItem("skipIntroDuration", String(seconds));
  };

  const setSkipOutroDuration = async (seconds: number) => {
    setSkipOutroDurationState(seconds);
    await AsyncStorage.setItem("skipOutroDuration", String(seconds));
  };

  // Setup Player
  useEffect(() => {
    const setupPlayer = async () => {
      try {
        await TrackPlayer.setupPlayer({
          iosCategory: IOSCategory.Playback,
          iosCategoryMode: IOSCategoryMode.Default,
          iosCategoryOptions: [
            IOSCategoryOptions.AllowBluetooth,
            IOSCategoryOptions.AllowBluetoothA2DP,
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.DuckOthers,
          ],
        });
        await updatePlayerCapabilities();
        setIsSetup(true);
      } catch (error: any) {
        if (error?.message?.includes("already been initialized")) {
          setIsSetup(true);
        } else {
          console.error("[TrackPlayer] setup failed", error);
        }
      }
    };
    setupPlayer();
  }, []);

  // Sync TrackPlayer events
  useTrackPlayerEvents(
    [
      Event.PlaybackState,
      Event.PlaybackError,
      Event.PlaybackQueueEnded,
      Event.RemoteNext,
      Event.RemotePrevious,
      Event.RemoteJumpForward,
      Event.RemoteJumpBackward,
    ],
    async (event) => {
      if (event.type === Event.PlaybackError) {
        console.error(
          "An error occurred while playing the current track.",
          event
        );
      }
      if (event.type === Event.PlaybackState) {
        setIsPlaying(event.state === State.Playing);
        setIsLoading(
          event.state === State.Buffering || event.state === State.Loading
        );
      }
      if (event.type === Event.PlaybackQueueEnded) {
        playNext();
      }
      if (event.type === Event.RemoteNext) {
        playNext();
      }
      if (event.type === Event.RemotePrevious) {
        playPrevious();
      }
      if (event.type === Event.RemoteJumpForward) {
        seekTo(positionRef.current + (event.interval || 15));
      }
      if (event.type === Event.RemoteJumpBackward) {
        seekTo(Math.max(0, positionRef.current - (event.interval || 15)));
      }
    }
  );

  // ✨ 监控片尾自动跳过逻辑
  useEffect(() => {
    // 只有有声书且正在播放且设置了跳过片尾才生效
    if (
      !isPlaying ||
      skipOutroDuration <= 0 ||
      duration <= 0 ||
      currentTrack?.type !== TrackType.AUDIOBOOK
    )
      return;

    const remaining = duration - position;

    // remaining > 1 是为了防止刚加载时 position 为 0 导致误判 (虽然 playTrack 会 Seek)
    // 或者是防止 duration 还没完全加载出来
    if (
      remaining <= skipOutroDuration &&
      remaining > 0.5 &&
      !isSkippingOutroRef.current
    ) {
      console.log(
        `[AutoSkip] Outro detected (${remaining.toFixed(1)}s left), skipping to next.`
      );
      isSkippingOutroRef.current = true;
      playNext();
    }
  }, [position, duration, isPlaying, skipOutroDuration, currentTrack]);

  const getNextIndex = (
    currentIndex: number,
    mode: PlayMode,
    list: Track[]
  ) => {
    if (list.length === 0) return -1;
    switch (mode) {
      case PlayMode.SEQUENCE:
        return currentIndex + 1 < list.length ? currentIndex + 1 : -1;
      case PlayMode.LOOP_LIST:
        return (currentIndex + 1) % list.length;
      case PlayMode.SHUFFLE:
        return Math.floor(Math.random() * list.length);
      case PlayMode.LOOP_SINGLE:
        return currentIndex;
      case PlayMode.SINGLE_ONCE:
        return -1;
      default:
        return currentIndex + 1 < list.length ? currentIndex + 1 : -1;
    }
  };

  const getPreviousIndex = (
    currentIndex: number,
    mode: PlayMode,
    list: Track[]
  ) => {
    if (list.length === 0) return -1;
    if (currentIndex > 0) return currentIndex - 1;
    return list.length - 1;
  };

  const updatePlayerCapabilities = async (track?: Track) => {
    const isAudiobookAndroid =
      Platform.OS === "android" && track?.type === TrackType.AUDIOBOOK;

    const capabilities = [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.Stop,
      Capability.SeekTo,
    ];

    const compactCapabilities = [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ];

    if (isAudiobookAndroid) {
      capabilities.push(Capability.JumpBackward);
      capabilities.push(Capability.JumpForward);
      compactCapabilities.push(Capability.JumpBackward);
      compactCapabilities.push(Capability.JumpForward);
    }

    await TrackPlayer.updateOptions({
      capabilities,
      compactCapabilities,
      // @ts-ignore
      jumpForwardInterval: 15,
      // @ts-ignore
      jumpBackwardInterval: 15,
      // ✨ 优化：缩短进度更新间隔以提高片尾跳过精度
      progressUpdateEventInterval: 1,
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
    } as any);
  };

  const playNext = async () => {
    const list = trackListRef.current;
    if (playModeRef.current === PlayMode.LOOP_SINGLE) {
      await seekTo(0);
      return;
    }
    const current = currentTrackRef.current;
    if (!current || list.length === 0) return;
    const currentIndex = list.findIndex((t) => t.id === current.id);
    if (currentIndex === -1) return;
    const nextIndex = getNextIndex(currentIndex, playModeRef.current, list);
    if (nextIndex !== -1) {
      await playTrack(list[nextIndex]);
    } else {
      await TrackPlayer.pause();
    }
  };

  const playPrevious = async () => {
    const list = trackListRef.current;
    const current = currentTrackRef.current;
    if (!current || list.length === 0) return;
    const currentIndex = list.findIndex((t) => t.id === current.id);
    if (currentIndex === -1) return;
    const prevIndex = getPreviousIndex(currentIndex, playModeRef.current, list);
    if (prevIndex !== -1) {
      await playTrack(list[prevIndex]);
    }
  };

  const togglePlayMode = () => {
    const modes = Object.values(PlayMode);
    const currentIndex = modes.indexOf(playMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setPlayMode(nextMode);
    savePlaybackState(mode);
  };

  const savePlaybackState = async (targetMode: string) => {
    if (!currentTrackRef.current || !isSetup) return;
    const state = {
      currentTrack: currentTrackRef.current,
      trackList: trackListRef.current,
      position: positionRef.current,
      playMode: playModeRef.current,
      playbackRate: playbackRateRef.current,
    };
    try {
      await AsyncStorage.setItem(
        `playbackState_${targetMode}`,
        JSON.stringify(state)
      );
    } catch (e) {
      console.error("Failed to save playback state", e);
    }
  };

  const loadPlaybackState = async (targetMode: string) => {
    if (!isSetup) return;
    try {
      const saved = await AsyncStorage.getItem(`playbackState_${targetMode}`);
      if (saved) {
        const state = JSON.parse(saved);
        setTrackList(state.trackList);
        setPlayMode(state.playMode);
        if (state.playbackRate) {
          setPlaybackRateState(state.playbackRate);
        }
        if (state.currentTrack) {
          const track = state.currentTrack;
          const uri = await resolveTrackUri(track, { cacheEnabled });
          const artwork = resolveArtworkUri(track);

          await TrackPlayer.reset();
          await TrackPlayer.add({
            id: String(track.id),
            url: uri,
            title: track.name,
            artist: track.artist,
            album: track.album || "Unknown Album",
            artwork: artwork,
            duration: track.duration || 0,
          });

          if (state.position) {
            await TrackPlayer.seekTo(state.position);
          }

          await updatePlayerCapabilities(track);
          setCurrentTrack(track);
        }
      } else {
        setCurrentTrack(null);
        setTrackList([]);
        await TrackPlayer.reset();
      }
    } catch (e) {
      console.error("Failed to load playback state", e);
    }
  };

  useEffect(() => {
    if (!isSetup || isAuthLoading) return;
    const handleModeChange = async () => {
      if (isInitialLoadRef.current) {
        await loadPlaybackState(mode);
        isInitialLoadRef.current = false;
        prevModeRef.current = mode;
      } else if (prevModeRef.current !== mode) {
        await savePlaybackState(prevModeRef.current);
        await loadPlaybackState(mode);
        prevModeRef.current = mode;
      }
    };
    handleModeChange();
  }, [mode, isSetup, isAuthLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && isSetup) {
        savePlaybackState(mode);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isPlaying, isSetup, mode]);

  const playTrack = async (track: Track, initialPosition?: number) => {
    if (!isSetup) return;
    try {
      // ✨ 重置片尾跳过锁
      isSkippingOutroRef.current = false;

      const playUri = await resolveTrackUri(track, { cacheEnabled });
      const artwork = resolveArtworkUri(track);

      console.log("Playing track:", track.id, "URI:", playUri);

      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: String(track.id),
        url: playUri,
        title: track.name,
        artist: track.artist,
        album: track.album || "Unknown Album",
        artwork: artwork,
        duration: track.duration || 0,
      });

      await updatePlayerCapabilities(track);

      // ✨ 处理初始位置 & 自动跳过片头
      let startPos = 0;

      // 优先级：显式指定的 initialPosition (恢复进度) > 自动跳过设置
      if (initialPosition !== undefined) {
        startPos = initialPosition;
      } else if (
        skipIntroDuration > 0 &&
        track.type === TrackType.AUDIOBOOK // 仅有声书生效
      ) {
        console.log(`[AutoSkip] Skipping intro: ${skipIntroDuration}s`);
        startPos = skipIntroDuration;
      }

      if (startPos > 0) {
        await TrackPlayer.seekTo(startPos);
      }

      await TrackPlayer.play();
      setCurrentTrack(track);
      savePlaybackState(mode);
    } catch (error) {
      console.error("Failed to play track:", error);
    }
  };

  const playTrackList = async (tracks: Track[], index: number) => {
    setTrackList(tracks);
    if (tracks[index]) {
      await playTrack(tracks[index]);
      savePlaybackState(mode);
    }
  };

  const broadcastSync = (type: string, data?: any) => {
    if (isSynced && sessionId && !isProcessingSync.current) {
      socketService.emit("sync_command", {
        sessionId,
        type,
        data,
      });
    }
  };

  const pause = async () => {
    if (isSetup) {
      try {
        await TrackPlayer.pause();
        savePlaybackState(mode);
      } catch (error) {
        console.error("Failed to pause:", error);
      }
    }
  };

  const resume = async () => {
    if (isSetup) {
      try {
        await TrackPlayer.play();
        savePlaybackState(mode);
      } catch (error) {
        console.error("Failed to resume:", error);
      }
    }
  };

  const seekTo = async (pos: number) => {
    if (isSetup) {
      try {
        await TrackPlayer.seekTo(pos);
        broadcastSync("seek", pos);
      } catch (error) {
        console.error("Failed to seek:", error);
      }
    }
  };

  const setPlaybackRate = async (rate: number) => {
    if (isSetup) {
      try {
        await TrackPlayer.setRate(rate);
        setPlaybackRateState(rate);
        savePlaybackState(mode);
      } catch (error) {
        console.error("Failed to set playback rate:", error);
      }
    }
  };

  const handleDisconnect = () => {
    Alert.alert("结束同步播放", "确定要断开连接吗？", [
      {
        text: "取消",
        style: "cancel",
      },
      {
        text: "确定",
        onPress: () => {
          console.log("User confirmed disconnect", sessionId);
          if (sessionId) {
            socketService.emit("player_left", { sessionId });
            setSynced(false, null);
            setParticipants([]);
          }
        },
      },
    ]);
  };

  const recordHistory = async () => {
    if (currentTrackRef.current && user) {
      const deviceName = Device.modelName || "Mobile Device";
      const deviceId = device?.id;
      try {
        await addToHistory(
          currentTrackRef.current.id,
          user.id,
          Math.floor(positionRef.current),
          deviceName,
          deviceId,
          isSynced
        );
        if (currentTrackRef.current.albumId) {
          await addAlbumToHistory(currentTrackRef.current.albumId, user.id);
        }
        if (currentTrackRef.current.type === TrackType.AUDIOBOOK) {
          await reportAudiobookProgress({
            userId: user.id,
            trackId: currentTrackRef.current.id,
            progress: Math.floor(positionRef.current),
          });
        }
      } catch (e) {
        console.log(
          "Background history sync skipped due to network/transient error"
        );
      }
    }
  };

  const isProcessingSync = useRef(false);
  const {
    isSynced,
    sessionId,
    setSynced,
    setParticipants,
    lastAcceptedInvite,
  } = useSync();

  useEffect(() => {
    if (isSynced && sessionId) {
      const handleSyncEvent = (payload: {
        type: string;
        data: any;
        fromUserId: number;
      }) => {
        if (payload.fromUserId === user?.id) return;
        isProcessingSync.current = true;
        switch (payload.type) {
          case "play":
            resume();
            break;
          case "pause":
            pause();
            break;
          case "seek":
            seekTo(payload.data);
            break;
          case "track_change":
            playTrack(payload.data);
            break;
          case "playlist":
            setTrackList(payload.data);
            break;
          case "leave":
            console.log("Participant left the session");
            Alert.alert("同步状态", "对方已断开同步连接");
            break;
        }
        setTimeout(() => {
          isProcessingSync.current = false;
        }, 100);
      };

      const handleRequestInitialState = (payload: {
        sessionId: string;
        fromSocketId: string;
      }) => {
        if (currentTrack) {
          socketService.emit("sync_command", {
            sessionId: payload.sessionId,
            type: "track_change",
            data: currentTrack,
            targetSocketId: payload.fromSocketId,
          });
          setTimeout(() => {
            socketService.emit("sync_command", {
              sessionId: payload.sessionId,
              type: isPlaying ? "play" : "pause",
              data: position,
              targetSocketId: payload.fromSocketId,
            });
          }, 200);
        }
      };

      socketService.on("sync_event", handleSyncEvent);
      socketService.on("request_initial_state", handleRequestInitialState);

      return () => {
        socketService.off("sync_event", handleSyncEvent);
        socketService.off("request_initial_state", handleRequestInitialState);
      };
    }
  }, [isSynced, sessionId, currentTrack, isPlaying, position]);

  useEffect(() => {
    if (isSynced && lastAcceptedInvite && !currentTrack) {
      console.log("Applying invite context: playlist and track");
      if (lastAcceptedInvite.playlist) {
        setTrackList(lastAcceptedInvite.playlist);
      }
      if (lastAcceptedInvite.currentTrack) {
        if (isSetup) {
          playTrack(
            lastAcceptedInvite.currentTrack,
            lastAcceptedInvite.progress
          );
        }
      }
    }
  }, [isSynced, lastAcceptedInvite, isSetup]);

  useEffect(() => {
    const handleSessionEnded = () => {
      Alert.alert("同步状态", "同步播放已结束");
      setSynced(false, null);
      setParticipants([]);
      console.log("Sync session ended");
    };
    const handlePlayerLeft = (payload: {
      username: string;
      deviceName: string;
    }) => {
      Alert.alert(
        "同步状态",
        `${payload.username} (${payload.deviceName}) 已断开同步连接`
      );
    };
    socketService.on("session_ended", handleSessionEnded);
    socketService.on("player_left", handlePlayerLeft);
    return () => {
      socketService.off("session_ended", handleSessionEnded);
      socketService.off("player_left", handlePlayerLeft);
    };
  }, [setSynced, setParticipants]);

  useEffect(() => {
    if (isSynced && sessionId && !isProcessingSync.current) {
      socketService.emit("sync_command", {
        sessionId,
        type: isPlaying ? "play" : "pause",
        data: null,
      });
    }
  }, [isPlaying, isSynced, sessionId]);

  useEffect(() => {
    if (isSynced && sessionId && !isProcessingSync.current && currentTrack) {
      socketService.emit("sync_command", {
        sessionId,
        type: "track_change",
        data: currentTrack,
      });
    }
  }, [currentTrack?.id, isSynced, sessionId]);

  useEffect(() => {
    if (
      isSynced &&
      sessionId &&
      !isProcessingSync.current &&
      trackList.length > 0
    ) {
      socketService.emit("sync_command", {
        sessionId,
        type: "playlist",
        data: trackList,
      });
    }
  }, [trackList, isSynced, sessionId]);

  useEffect(() => {
    if (currentTrack) {
      recordHistory();
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!isPlaying && currentTrack) {
      recordHistory();
    }
  }, [isPlaying]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        recordHistory();
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (user && isSetup && acceptRelay) {
      const checkResume = async () => {
        try {
          const res = await getLatestHistory(user.id);
          if (res.code === 200 && res.data) {
            const history = res.data;
            const deviceName = Device.modelName || "Mobile Device";
            const diff =
              new Date().getTime() - new Date(history.listenedAt).getTime();
            const isRecent = diff < 24 * 60 * 60 * 1000;
            const isOtherDevice = history.deviceName !== deviceName;
            if (isRecent && isOtherDevice && history.track) {
              const m = Math.floor(history.progress / 60);
              const s = Math.floor(history.progress % 60)
                .toString()
                .padStart(2, "0");
              showNotification({
                type: "resume",
                track: history.track,
                title: "继续播放",
                description: `发现在设备 ${history.deviceName} 上的播放记录，是否从 ${m}:${s} 继续播放？`,
                onAccept: () => playTrack(history.track, history.progress),
                onReject: () => {},
              });
            }
          }
        } catch (e) {
          console.error("Check resume error", e);
        }
      };
      checkResume();
    }
  }, [user?.id, isSetup]);

  const setSleepTimer = (minutes: number) => {
    const expiryTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerState(expiryTime);
  };

  const clearSleepTimer = () => {
    setSleepTimerState(null);
  };

  useEffect(() => {
    if (!sleepTimer || !isPlaying) return;
    const checkTimer = setInterval(() => {
      if (Date.now() >= sleepTimer) {
        pause();
        setSleepTimerState(null);
      }
    }, 1000);
    return () => clearInterval(checkTimer);
  }, [sleepTimer, isPlaying]);

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        currentTrack,
        position,
        duration,
        isLoading,
        playTrack,
        pause,
        resume,
        seekTo,
        trackList,
        playTrackList,
        playMode,
        togglePlayMode,
        playNext,
        playPrevious,
        isSynced,
        sessionId,
        handleDisconnect,
        showPlaylist,
        setShowPlaylist,
        sleepTimer,
        setSleepTimer,
        clearSleepTimer,
        playbackRate,
        setPlaybackRate,
        // ✨ Exports
        skipIntroDuration,
        setSkipIntroDuration,
        skipOutroDuration,
        setSkipOutroDuration,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
