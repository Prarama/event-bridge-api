const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users } = require('../data/store');
const { sendRegistrationEmail } = require('../services/emailService');

/**
 * Helper to generate a unique ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

/**
 * Handle user registration (POST /register)
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Role validation
    const userRole = role || 'attendee';
    if (!['organizer', 'attendee'].includes(userRole)) {
      return res.status(400).json({ error: 'Role must be either "organizer" or "attendee".' });
    }

    // Check if user already exists
    const existingUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user object
    const newUser = {
      id: generateId(),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
    };

    // Store in-memory
    users.push(newUser);

    // Send platform registration email asynchronously (do not block the registration success response if it takes too long, but wait or catch errors)
    // We will await the email send but catch errors so registration still succeeds
    try {
      await sendRegistrationEmail(newUser.email, newUser.name);
    } catch (emailError) {
      console.error(`Email notification failed for user ${newUser.email}:`, emailError);
    }

    // Prepare response (exclude password)
    const userResponse = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };

    return res.status(201).json({
      message: 'User registered successfully.',
      user: userResponse,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'An error occurred during registration.' });
  }
};

/**
 * Handle user login (POST /login)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find the user
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_key_12345',
      { expiresIn: '24h' }
    );

    // Return response
    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'An error occurred during login.' });
  }
};

module.exports = {
  register,
  login,
};
