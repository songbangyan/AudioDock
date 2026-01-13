import {
  FolderOpenOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Button, Col, Empty, message, Row, Tooltip, Typography } from "antd";
import React, { useEffect, useState } from "react";
import Cover from "../../components/Cover/index";
import TrackList from "../../components/TrackList";
import { type Album } from "../../models";
import { usePlayerStore } from "../../store/player";
import { useSettingsStore } from "../../store/settings";
import { usePlayMode } from "../../utils/playMode";
import styles from "./index.module.less";

const { Title } = Typography;

const Downloads: React.FC = () => {
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { play, setPlaylist } = usePlayerStore();
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
             <TrackList
              tracks={localItems}
              loading={loading}
              showIndex={false}
              showArtist={true}
              showAlbum={true}
              onPlay={(track, tracks) => {
                setPlaylist(tracks);
                play(track, -1);
              }}
              onRefresh={fetchLocalItems}
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
