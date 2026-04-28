import type { Request } from "express";
import type { AuthUser } from "@crc/types";

export interface AuthRequest extends Request {
  user?: AuthUser;
}
