const { events, users } = require('../data/store');
const { sendEventRegistrationEmail } = require('../services/emailService');

/**
 * Helper to generate a unique ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

/**
 * Create a new event (POST /events)
 * Restricted to: organizer
 */
const createEvent = async (req, res) => {
  try {
    const { title, description, date, time } = req.body;

    // Validation
    if (!title || !description || !date || !time) {
      return res.status(400).json({ error: 'Title, description, date, and time are required.' });
    }

    const newEvent = {
      id: generateId(),
      title,
      description,
      date,
      time,
      organizerId: req.user.id,
      participants: [], // In-memory storage for participants: array of user objects { userId, name, email }
    };

    events.push(newEvent);

    return res.status(201).json({
      message: 'Event created successfully.',
      event: newEvent,
    });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: 'An error occurred while creating the event.' });
  }
};

/**
 * Get all events (GET /events)
 * Accessible to: all authenticated users
 */
const getEvents = async (req, res) => {
  try {
    return res.status(200).json({
      events,
    });
  } catch (error) {
    console.error('Get events error:', error);
    return res.status(500).json({ error: 'An error occurred while fetching events.' });
  }
};

/**
 * Get event details by ID (GET /events/:id)
 * Accessible to: all authenticated users
 */
const getEventById = async (req, res) => {
  try {
    const event = events.find((e) => e.id === req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    return res.status(200).json({ event });
  } catch (error) {
    console.error('Get event by ID error:', error);
    return res.status(500).json({ error: 'An error occurred while fetching the event details.' });
  }
};

/**
 * Update an existing event (PUT /events/:id)
 * Restricted to: organizer who created the event
 */
const updateEvent = async (req, res) => {
  try {
    const { title, description, date, time } = req.body;
    const eventId = req.params.id;

    const event = events.find((e) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Ensure the requester is the organizer who created the event
    if (event.organizerId !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden. You can only update your own events.' });
    }

    // Update fields
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (date !== undefined) event.date = date;
    if (time !== undefined) event.time = time;

    return res.status(200).json({
      message: 'Event updated successfully.',
      event,
    });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({ error: 'An error occurred while updating the event.' });
  }
};

/**
 * Delete an event (DELETE /events/:id)
 * Restricted to: organizer who created the event
 */
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const eventIndex = events.findIndex((e) => e.id === eventId);

    if (eventIndex === -1) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Ensure the requester is the organizer who created the event
    if (events[eventIndex].organizerId !== req.user.id) {
      return res.status(403).json({ error: 'Access forbidden. You can only delete your own events.' });
    }

    // Remove from in-memory array
    events.splice(eventIndex, 1);

    return res.status(200).json({
      message: 'Event deleted successfully.',
    });
  } catch (error) {
    console.error('Delete event error:', error);
    return res.status(500).json({ error: 'An error occurred while deleting the event.' });
  }
};

/**
 * Register current user for an event (POST /events/:id/register)
 * Restricted to: attendee
 */
const registerForEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = events.find((e) => e.id === eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Prevent duplicate registration
    const isAlreadyRegistered = event.participants.some((p) => p.userId === req.user.id);
    if (isAlreadyRegistered) {
      return res.status(400).json({ error: 'You are already registered for this event.' });
    }

    // Register attendee
    const participant = {
      userId: req.user.id,
      name: req.user.name,
      email: req.user.email,
    };

    event.participants.push(participant);

    // Send registration email asynchronously using async/await & Promises
    try {
      await sendEventRegistrationEmail(
        req.user.email,
        req.user.name,
        event.title,
        event.date,
        event.time
      );
    } catch (emailError) {
      console.error(`Event confirmation email failed for user ${req.user.email}:`, emailError);
    }

    return res.status(200).json({
      message: 'Successfully registered for the event.',
      event,
    });
  } catch (error) {
    console.error('Event registration error:', error);
    return res.status(500).json({ error: 'An error occurred during event registration.' });
  }
};

/**
 * View event registrations for the logged-in user (GET /events/my-registrations)
 * Accessible to: all authenticated users
 */
const getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;
    const myEvents = events.filter((e) =>
      e.participants.some((p) => p.userId === userId)
    );

    return res.status(200).json({
      registrations: myEvents,
    });
  } catch (error) {
    console.error('Get my registrations error:', error);
    return res.status(500).json({ error: 'An error occurred while fetching registrations.' });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getMyRegistrations,
};
