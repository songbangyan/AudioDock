import { ISuccessResponse, LoginResponse, User } from '../models';
import request from '../utils/request';

export const login = (data: Partial<User>) => {
  return request.post<any, ISuccessResponse<LoginResponse>>("/auth/login", data);
};

export const register = (data: Partial<User>) => {
  return request.post<any, ISuccessResponse<LoginResponse>>("/auth/register", data);
};

export const check = () => {
  return request.get<any, ISuccessResponse<boolean>>("/auth/check");
};

export const hello = () => {
  return request.get<any, ISuccessResponse<string>>("/hello");
};
