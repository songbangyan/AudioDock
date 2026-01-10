export interface ISuccessResponse<T> {
  code: number;
  message: string;
  data: T;
}

export enum TrackType {
  MUSIC = "MUSIC",
  AUDIOBOOK = "AUDIOBOOK",
}

export interface IErrorResponse {
  code: number;
  message: string;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  is_admin: boolean;
  likedTracks?: any[]; // Simplified for now
  listenedTracks?: any[];
  playlists?: any[];
}

export interface LoginResponse {
  token: string;
  user: User;
  device?: any;
}
