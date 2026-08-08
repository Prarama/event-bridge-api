const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users, usersByEmail, usersById, emailsInRegistration } = require('../data/store');
const { sendRegistrationEmail } = require('../services/emailService');

/**
 * Helper to generate a unique ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// Simple regex for basic email format validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Handle user registration (POST /register)
 */
const register = async (req, res) => {
  let normalizedEmail = '';
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    normalizedEmail = trimmedEmail.toLowerCase();

    // Validate email format
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Role validation
    const userRole = role || 'attendee';
    if (!['organizer', 'attendee'].includes(userRole)) {
      return res.status(400).json({ error: 'Role must be either "organizer" or "attendee".' });
    }

    // Check if user already exists (using fast index lookup & concurrent registration lock)
    if (usersByEmail[normalizedEmail] || emailsInRegistration.has(normalizedEmail)) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    // Acquire lock for this email to prevent concurrent registration race conditions
    emailsInRegistration.add(normalizedEmail);

    // Hash the password and create the user
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user object
      const newUser = {
        id: generateId(),
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole,
      };

      // Store in-memory and update indexes
      users.push(newUser);
      usersByEmail[normalizedEmail] = newUser;
      usersById[newUser.id] = newUser;

      // Send platform registration email asynchronously (catch errors so signup still succeeds)
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
    } finally {
      // Ensure lock is released even if password hashing or storage fails
      emailsInRegistration.delete(normalizedEmail);
    }
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

    const normalizedEmail = email.trim().toLowerCase();

    // Find the user using O(1) index map
    const user = usersByEmail[normalizedEmail];
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
