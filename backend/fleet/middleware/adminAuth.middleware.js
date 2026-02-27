/**
 * adminAuth.middleware.js
 *
 * Guards admin-only routes.
 * Expects the request header:  x-admin-secret: <ADMIN_SECRET>
 * Returns 401 if missing or wrong.
 */

const adminAuth = (req, res, next) => {
    const secret = req.headers["x-admin-secret"];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ message: "Unauthorized: admin access required" });
    }
    next();
};

module.exports = adminAuth;
