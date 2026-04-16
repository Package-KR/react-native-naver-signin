export type NaverOAuthToken = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
};

export type NaverProfile = {
  id: string;
  nickname: string | null;
  name: string | null;
  email: string | null;
  profileImage: string | null;
  gender: string | null;
  age: string | null;
  birthday: string | null;
  birthyear: string | null;
  mobile: string | null;
};
