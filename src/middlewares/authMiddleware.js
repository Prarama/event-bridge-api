const jwt = require('jsonwebtoken');
const { usersById } = require('../data/store');

/**
 * Middleware to authenticate requests using JWT tokens.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
    
    // Find the user in our in-memory store
    const user = usersById[decoded.id];
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    // Attach user information to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;
