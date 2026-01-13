import {
  getAlbumsByArtist,
  getArtistById,
  getCollaborativeAlbumsByArtist,
  getTracksByArtist,
} from "@soundx/services";
import { Avatar, Col, Empty, Flex, Row, Skeleton, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Cover from "../../components/Cover";
import TrackList from "../../components/TrackList";
import { useMessage } from "../../context/MessageContext";
import { type Album, type Artist, type Track, TrackType } from "../../models";
import { getCoverUrl } from "../../utils";
import { usePlayMode } from "../../utils/playMode";
import styles from "./index.module.less";

const { Title } = Typography;

const ArtistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const message = useMessage();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [collaborativeAlbums, setCollaborativeAlbums] = useState<Album[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { mode } = usePlayMode();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const artistRes = await getArtistById(parseInt(id));
        if (artistRes.code === 200 && artistRes.data) {
          setArtist(artistRes.data);
          // Fetch albums using artist name
          const [albumsRes, collaborativeRes, tracksRes] = await Promise.all([
            getAlbumsByArtist(artistRes.data.name),
            getCollaborativeAlbumsByArtist(artistRes.data.name),
            getTracksByArtist(artistRes.data.name),
          ]);

          if (albumsRes.code === 200 && albumsRes.data) {
            setAlbums(albumsRes.data);
          }
          if (collaborativeRes.code === 200 && collaborativeRes.data) {
            setCollaborativeAlbums(collaborativeRes.data);
          }
          if (tracksRes.code === 200 && tracksRes.data) {
            setTracks(tracksRes.data);
          }
        } else {
          message.error("Failed to load artist details");
        }
      } catch (error) {
        console.error("Error fetching artist details:", error);
        message.error("Error fetching artist details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <Flex vertical gap={24} className={styles.container}>
        <Flex vertical align="center" gap={34}>
          <Skeleton.Avatar active size={200} />
          <Skeleton.Input active />
        </Flex>
        <Skeleton.Input active />
        <Flex gap={24}>
          <Flex vertical gap={24}>
            <Skeleton.Node style={{ width: 170, height: 170 }} active />
            <Skeleton.Input active />
            <Skeleton.Input active />
          </Flex>
          <Flex vertical gap={24}>
            <Skeleton.Node style={{ width: 170, height: 170 }} active />
            <Skeleton.Input active />
            <Skeleton.Input active />
          </Flex>
          <Flex vertical gap={24}>
            <Skeleton.Node style={{ width: 170, height: 170 }} active />
            <Skeleton.Input active />
            <Skeleton.Input active />
          </Flex>
          <Flex vertical gap={24}>
            <Skeleton.Node style={{ width: 170, height: 170 }} active />
            <Skeleton.Input active />
            <Skeleton.Input active />
          </Flex>
        </Flex>
      </Flex>
    );
  }

  if (!artist) {
    return (
      <div className={styles.container}>
        <Empty description="Artist not found" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Avatar
          src={getCoverUrl(artist, artist.id)}
          size={200}
          shape="circle"
          className={styles.avatar}
          icon={!artist.avatar && artist.name[0]}
        />
        <Title level={2} className={styles.artistName}>
          {artist.name}
        </Title>
      </div>

      <div className={styles.content}>
        <Title level={4} className={styles.sectionTitle}>
          所有专辑 ({albums.length})
        </Title>
        <Row gutter={[24, 24]}>
          {albums.map((album) => (
            <Col key={album.id}>
              <Cover item={album} />
            </Col>
          ))}
        </Row>
        {albums.length === 0 && <Empty description="暂无专辑" />}
      </div>

      {collaborativeAlbums.length > 0 && (
        <div className={styles.content} style={{ marginTop: "48px" }}>
          <Title level={4} className={styles.sectionTitle}>
            合作专辑 ({collaborativeAlbums.length})
          </Title>
          <Row gutter={[24, 24]}>
            {collaborativeAlbums.map((album) => (
              <Col key={album.id}>
                <Cover item={album} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {mode === TrackType.MUSIC && (
        <div style={{ marginTop: "48px" }}>
          <Title level={4} className={styles.sectionTitle}>
            所有单曲 ({tracks.length})
          </Title>
          <TrackList
            tracks={tracks}
            type={artist?.type}
            showAlbum={false}
            showArtist={false}
          />
        </div>
      )}
    </div>
  );
};

export default ArtistDetail;
