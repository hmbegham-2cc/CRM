import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role, AuthUser } from "@crc/types";
import type { AuthRequest } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const token = raw.slice("Bearer ".length);
  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Session invalide" });
  }
}

export function requireRole(roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }
    next();
  };
}
