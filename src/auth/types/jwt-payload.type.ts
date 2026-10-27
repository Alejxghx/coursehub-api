// Only public identity belongs in the payload. JwtService adds iat and exp.
export type JwtPayload = {
  sub: number;
  email: string;
};

export type AuthenticatedUser = {
  id: number;
  email: string;
};
