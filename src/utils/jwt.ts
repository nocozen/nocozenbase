import { SignJWT, jwtVerify } from 'jose';
import * as M from '../types/meta.js';
import config from '../utils/config.js';

const jwtSecretKey = config.http.jwtKey;
const tokenExpiresIn = config.http.tokenExpiresIn || '16h';

export async function generateToken(payload: {account: M.Account, en_id: string}) {
  const secretKey = new TextEncoder().encode(jwtSecretKey); 
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(tokenExpiresIn)  
    .sign(secretKey);                   
  return token;
}

export async function verifyToken(token: string) {
  const secretKey = new TextEncoder().encode(jwtSecretKey);
  const { payload } = await jwtVerify(token, secretKey);
  return payload;
}
