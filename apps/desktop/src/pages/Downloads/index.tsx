import {
  FolderOpenOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Button, Col, Empty, message, Row, Table, theme, Tooltip, Typography } from "antd";
import React, { useEffect, useState } from "react";
import Cover from "../../components/Cover/index";
import { type Album, type Track } from "../../models";
import { usePlayerStore } from "../../store/player";
import { useSettingsStore } from "../../store/settings";
import { formatDuration } from "../../utils/formatDuration";
import { usePlayMode } from "../../utils/playMode";
import styles from "./index.module.less";

const { Title, Text } = Typography;

const Downloads: React.FC = () => {
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();
  const { play, setPlaylist, currentTrack, isPlaying } = usePlayerStore();
  const { mode } = usePlayMode();
  const downloadPath = useSettingsStore((state) => state.download.downloadPath);

  const fetchLocalItems = async () => {
    if (!(window as any).ipcRenderer) return;
    setLoading(true);
    try {
      const results = await (window as any).ipcRenderer.invoke(
        "cache:list",
        downloadPath,
        mode
      );
      setLocalItems(results);
    } catch (error) {
      console.error("Failed to fetch local items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocalItems();
  }, [mode, downloadPath]);

  const handlePlayTrack = (track: Track, tracks: Track[]) => {
    setPlaylist(tracks);
    play(track, -1);
  };

  const handleOpenFolder = () => {
    if (!(window as any).ipcRenderer) return;
    const subFolder = mode === "MUSIC" ? "music" : "audio";
    const fullPath = downloadPath + "/" + subFolder;
    (window as any).ipcRenderer.invoke("open-directory", fullPath).then((res: any) => {
      if (res && typeof res === "string" && res.includes("Could not")) {
        message.error(res);
      }
    });
  };

  const columns = [
    {
      title: " ",
      key: "play",
      width: 50,
      render: (_: any, record: Track) => {
        const isCurrent = currentTrack?.id === record.id;
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePlayTrack(record, localItems as Track[]);
            }}
            style={{ cursor: "pointer" }}
          >
            {isCurrent && isPlaying ? (
              <PauseCircleOutlined style={{ color: token.colorPrimary }} />
            ) : (
              <PlayCircleOutlined />
            )}
          </div>
        );
      },
    },
    {
      title: "标题",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: Track) => (
        <Text
          strong={currentTrack?.id === record.id}
          style={{
            color:
              currentTrack?.id === record.id ? token.colorPrimary : undefined,
          }}
        >
          {text}
        </Text>
      ),
    },
    {
      title: "艺术家",
      dataIndex: "artist",
      key: "artist",
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: "专辑",
      dataIndex: "album",
      key: "album",
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: "时长",
      dataIndex: "duration",
      key: "duration",
      width: 100,
      render: (duration: number) => (
        <Text type="secondary">{formatDuration(duration)}</Text>
      ),
    },
  ];

  // Group by album for Audiobook mode
  const albums: any[] = [];
  if (mode === "AUDIOBOOK") {
    const albumMap = new Map<string, any>();
    localItems.forEach((item) => {
      if (!albumMap.has(item.album)) {
        albumMap.set(item.album, {
          id: item.albumId || item.album, // Fallback if no ID
          name: item.album,
          artist: item.artist,
          cover: item.cover,
          type: mode,
          tracks: [],
        });
      }
      albumMap.get(item.album).tracks.push(item);
    });
    albumMap.forEach((val) => albums.push(val));
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <Title level={2} className={styles.title}>
          下载
        </Title>
        <div style={{ display: "flex", gap: "8px" }}>
          <Tooltip title="打开下载文件夹">
            <Button
              type="text"
              icon={<FolderOpenOutlined />}
              onClick={handleOpenFolder}
            />
          </Tooltip>
          <Button
            type="text"
            icon={<SyncOutlined spin={loading} />}
            onClick={fetchLocalItems}
            loading={loading}
          >
            刷新
          </Button>
        </div>
      </div>

      <div className={styles.content}>
        {mode === "MUSIC" ? (
          localItems.length === 0 ? (
            <></>
          ) : (
            <Table
              dataSource={localItems}
              columns={columns}
              pagination={false}
              rowKey="id"
              size="small"
              onRow={(record) => ({
                onDoubleClick: () => {
                  handlePlayTrack(record, localItems as Track[]);
                },
              })}
            />
          )
        ) : (
          <Row gutter={[16, 16]}>
            {albums.map((album) => (
              <Col key={album.name}>
                <Cover item={album as Album} />
              </Col>
            ))}
          </Row>
        )}

        {localItems.length === 0 && !loading && (
          <div className={styles.noData}>
            <Empty description="暂无下载内容" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Downloads;
