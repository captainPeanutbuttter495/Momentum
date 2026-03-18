import { expressjwt } from "express-jwt";
import jwksRsa from "jwks-rsa";
import prisma from "../db.js";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// Middleware to verify Auth0 JWT token
export const checkJwt = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: AUTH0_AUDIENCE,
  issuer: `https://${AUTH0_DOMAIN}/`,
  algorithms: ["RS256"],
});

// Middleware to attach user from database to request
// Auto-creates a minimal User record on first encounter; full profile is created during onboarding
export const attachUser = async (req, res, next) => {
  try {
    if (!req.auth?.sub) {
      return res.status(401).json({ error: "No authenticated user" });
    }

    let user = await prisma.user.findUnique({
      where: { auth0Id: req.auth.sub },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          auth0Id: req.auth.sub,
          email: req.auth.email || req.auth[`https://momentum.app/email`] || "unknown",
          name: req.auth.name || req.auth[`https://momentum.app/name`] || null,
          role: "USER",
        },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account has been deactivated" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error attaching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Middleware to require specific roles
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: "Profile setup required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Convenience exports
export const requireUser = requireRole("USER");

// Combined middleware
export const authenticated = [checkJwt, attachUser];
