const users = [];
const events = [];

// Indexing maps for O(1) performance optimization
const usersByEmail = {}; // email (lowercase) -> user object
const usersById = {};    // id -> user object
const eventsById = {};   // id -> event object

// Concurrency lock set to prevent user registration race conditions
const emailsInRegistration = new Set();

module.exports = {
  users,
  events,
  usersByEmail,
  usersById,
  eventsById,
  emailsInRegistration,
};
