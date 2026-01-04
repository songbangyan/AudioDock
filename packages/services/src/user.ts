import { type ILoadMoreData, type ISuccessResponse } from "./models";
import request from "./request";

export const addToHistory = (trackId: number, userId: number, progress: number = 0, deviceName?: string, deviceId?: number, isSyncMode?: boolean) => {
  return request.post<any, ISuccessResponse<any>>("/user-track-histories", {
    trackId,
    userId,
    progress,
    deviceName,
    deviceId,
    isSyncMode,
  });
};

export const getLatestHistory = (userId: number) => {
    return request.get<any, ISuccessResponse<any>>("/user-track-histories/latest", {
        params: { userId }
    });
};

export const addAlbumToHistory = (albumId: number, userId: number) => {
  return request.post<any, ISuccessResponse<any>>("/user-album-histories", {
    albumId,
    userId,
  });
};

export const getAlbumHistory = (userId: number, loadCount: number, pageSize: number, type?: string) => {
  return request.get<any, ISuccessResponse<ILoadMoreData<any>>>("/user-album-histories/load-more", {
    params: { pageSize, loadCount, userId, type },
  });
};

export const toggleLike = (trackId: number, userId: number) => {
  return request.post<any, ISuccessResponse<any>>("/user-track-likes/create", {
    trackId,
    userId,
  });
};

export const toggleUnLike = (trackId: number, userId: number) => {
  return request.delete<any, ISuccessResponse<any>>("/user-track-likes/unlike", {
    params: { trackId, userId },
  });
};

export const toggleAlbumLike = (albumId: number, userId: number) => {
  return request.post<any, ISuccessResponse<any>>("/user-album-likes", {
    albumId,
    userId,
  });
};

export const unlikeAlbum = (albumId: number, userId: number) => {
  return request.delete<any, ISuccessResponse<any>>("/user-album-likes/unlike", {
    params: { albumId, userId },
  });
};

export const getFavoriteAlbums = (userId: number, loadCount: number, pageSize: number, type?: string) => {
  return request.get<any, ISuccessResponse<ILoadMoreData<any>>>("/user-album-likes/load-more", {
    params: { pageSize, loadCount, userId, type },
  });
};

export const getFavoriteTracks = (userId: number, loadCount: number, pageSize: number, type?: string) => {
  return request.get<any, ISuccessResponse<ILoadMoreData<any>>>("/user-track-likes/load-more", {
    params: { pageSize, loadCount: loadCount, userId, lastId: loadCount, type },
  });
};

export const getTrackHistory = (userId: number, loadCount: number, pageSize: number, type?: string) => {
  return request.get<any, ISuccessResponse<ILoadMoreData<any>>>("/user-track-histories/load-more", {
    params: { pageSize, loadCount: loadCount, userId, type },
  });
};

export const getUserList = () => {
  return request.get<any, ISuccessResponse<any[]>>("/user/list");
};
