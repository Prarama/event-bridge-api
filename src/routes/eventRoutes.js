const express = require('express');
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  registerForEvent,
  getMyRegistrations,
} = require('../controllers/eventController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// Apply authMiddleware to all event routes
router.use(authMiddleware);

// Get registrations for current logged-in user
// (Must be defined BEFORE /:id to prevent route clash)
router.get('/my-registrations', getMyRegistrations);

// Retrieve all events
router.get('/', getEvents);

// Retrieve single event details
router.get('/:id', getEventById);

// Create event (Organizer only)
router.post('/', roleMiddleware(['organizer']), createEvent);

// Update event details (Organizer only)
router.put('/:id', roleMiddleware(['organizer']), updateEvent);

// Delete event (Organizer only)
router.delete('/:id', roleMiddleware(['organizer']), deleteEvent);

// Register for an event (Attendee only)
router.post('/:id/register', roleMiddleware(['attendee']), registerForEvent);

module.exports = router;
