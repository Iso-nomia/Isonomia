import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "secret";

type Payload = { uid: string; id: string };

export function signGroupToken(payload: Payload) {
  return jwt.sign(payload, SECRET);
}

export function verifyGroupToken(token: string): Payload | null {
  try {
    return jwt.verify(token, SECRET) as Payload;
  } catch {
    return null;
  }
}
