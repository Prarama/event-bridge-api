const request = require('supertest');
const app = require('../app');
const { users, events } = require('../data/store');

// Mock email simulation delay so test runs fast
process.env.EMAIL_SIMULATION_DELAY = '0';

describe('EventBridge Platform API Integration Tests', () => {
  
  // Clear the in-memory database store before each test for state isolation
  beforeEach(() => {
    users.length = 0;
    events.length = 0;
  });

  describe('User Authentication & Profiles (POST /register & POST /login)', () => {
    const validOrganizer = {
      name: 'John Organizer',
      email: 'organizer@test.com',
      password: 'password123',
      role: 'organizer',
    };

    const validAttendee = {
      name: 'Alice Attendee',
      email: 'attendee@test.com',
      password: 'password123',
      role: 'attendee',
    };

    it('should register a new organizer successfully', async () => {
      const response = await request(app)
        .post('/register')
        .send(validOrganizer);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('registered successfully');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.name).toBe(validOrganizer.name);
      expect(response.body.user.email).toBe(validOrganizer.email);
      expect(response.body.user.role).toBe('organizer');
      expect(response.body.user).not.toHaveProperty('password');
      
      // Ensure it was added to in-memory store
      expect(users.length).toBe(1);
      expect(users[0].name).toBe(validOrganizer.name);
    });

    it('should register a new attendee successfully', async () => {
      const response = await request(app)
        .post('/register')
        .send(validAttendee);

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('attendee');
    });

    it('should reject registration if required fields are missing', async () => {
      const incompleteUser = {
        name: 'Incomplete',
        email: 'incomplete@test.com',
      };
      
      const response = await request(app)
        .post('/register')
        .send(incompleteUser);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration if email is already taken', async () => {
      // First registration
      await request(app).post('/register').send(validOrganizer);

      // Second registration with same email
      const response = await request(app)
        .post('/register')
        .send({
          name: 'Jane Clone',
          email: validOrganizer.email,
          password: 'newpassword',
          role: 'organizer',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should log in successfully with valid credentials and return a JWT token', async () => {
      // Register
      await request(app).post('/register').send(validOrganizer);

      // Log in
      const response = await request(app)
        .post('/login')
        .send({
          email: validOrganizer.email,
          password: validOrganizer.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(validOrganizer.email);
    });

    it('should reject login with incorrect password', async () => {
      await request(app).post('/register').send(validOrganizer);

      const response = await request(app)
        .post('/login')
        .send({
          email: validOrganizer.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login for non-existent email', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'notfound@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Event CRUD Operations & Authorization', () => {
    let organizerToken;
    let attendeeToken;
    let organizerId;

    beforeEach(async () => {
      // Register and login an organizer
      const regOrg = await request(app)
        .post('/register')
        .send({
          name: 'Main Organizer',
          email: 'mainorg@test.com',
          password: 'password123',
          role: 'organizer',
        });
      organizerId = regOrg.body.user.id;

      const loginOrg = await request(app)
        .post('/login')
        .send({ email: 'mainorg@test.com', password: 'password123' });
      organizerToken = loginOrg.body.token;

      // Register and login an attendee
      await request(app)
        .post('/register')
        .send({
          name: 'Main Attendee',
          email: 'mainatt@test.com',
          password: 'password123',
          role: 'attendee',
        });

      const loginAtt = await request(app)
        .post('/login')
        .send({ email: 'mainatt@test.com', password: 'password123' });
      attendeeToken = loginAtt.body.token;
    });

    it('should allow organizer to create an event successfully', async () => {
      const eventDetails = {
        title: 'Virtual Tech Conference',
        description: 'A grand virtual conference on emerging technologies.',
        date: '2026-09-15',
        time: '10:00 AM',
      };

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(eventDetails);

      expect(response.status).toBe(201);
      expect(response.body.event).toHaveProperty('id');
      expect(response.body.event.title).toBe(eventDetails.title);
      expect(response.body.event.organizerId).toBe(organizerId);
      expect(response.body.event.participants).toEqual([]);
      
      expect(events.length).toBe(1);
    });

    it('should forbid attendee from creating an event', async () => {
      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          title: 'Hacker Meetup',
          description: 'Fun meetup.',
          date: '2026-10-01',
          time: '06:00 PM',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('forbidden');
    });

    it('should reject event creation if parameters are missing', async () => {
      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Partial Event',
        });

      expect(response.status).toBe(400);
    });

    it('should fetch all events successfully for authenticated users', async () => {
      // Setup some events directly in store
      events.push(
        { id: '1', title: 'Event 1', description: 'Desc 1', date: '2026-08-01', time: '10:00', organizerId: 'org1', participants: [] },
        { id: '2', title: 'Event 2', description: 'Desc 2', date: '2026-08-02', time: '11:00', organizerId: 'org2', participants: [] }
      );

      const response = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.events.length).toBe(2);
    });

    it('should fetch single event details successfully', async () => {
      events.push({ id: '123', title: 'Event 123', description: 'Desc', date: '2026-08-01', time: '10:00', organizerId: 'org1', participants: [] });

      const response = await request(app)
        .get('/events/123')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.event.title).toBe('Event 123');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/events/missing-id')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(404);
    });

    it('should allow the organizing owner to update their own event', async () => {
      // Add event created by current organizer
      const originalEvent = {
        id: 'evt1',
        title: 'Original Title',
        description: 'Original Desc',
        date: '2026-08-08',
        time: '12:00',
        organizerId: organizerId,
        participants: [],
      };
      events.push(originalEvent);

      const response = await request(app)
        .put('/events/evt1')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: 'New Improved Title', date: '2026-08-09' });

      expect(response.status).toBe(200);
      expect(response.body.event.title).toBe('New Improved Title');
      expect(response.body.event.date).toBe('2026-08-09');
      expect(response.body.event.description).toBe('Original Desc'); // Unchanged
    });

    it('should prevent an organizer from updating other organizers events', async () => {
      const event = {
        id: 'evt1',
        title: 'Original Title',
        description: 'Original Desc',
        date: '2026-08-08',
        time: '12:00',
        organizerId: 'different-organizer-id',
        participants: [],
      };
      events.push(event);

      const response = await request(app)
        .put('/events/evt1')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: 'Hijacked Title' });

      expect(response.status).toBe(403);
      expect(events[0].title).toBe('Original Title'); // Ensure unchanged in memory
    });

    it('should allow organizing owner to delete their event', async () => {
      events.push({
        id: 'evt1',
        title: 'Delete Me',
        description: 'Desc',
        date: '2026-08-08',
        time: '12:00',
        organizerId: organizerId,
        participants: [],
      });

      const response = await request(app)
        .delete('/events/evt1')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(200);
      expect(events.length).toBe(0);
    });

    it('should prevent other organizers from deleting an event they did not create', async () => {
      events.push({
        id: 'evt1',
        title: 'Keep Me',
        description: 'Desc',
        date: '2026-08-08',
        time: '12:00',
        organizerId: 'other-org',
        participants: [],
      });

      const response = await request(app)
        .delete('/events/evt1')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(403);
      expect(events.length).toBe(1);
    });
  });

  describe('Attendee Event Registration (POST /events/:id/register & GET /events/my-registrations)', () => {
    let attendeeToken;
    let attendeeId;
    let organizerToken;
    let eventId;

    beforeEach(async () => {
      // Register/Login Organizer
      await request(app)
        .post('/register')
        .send({ name: 'Organizer', email: 'org@test.com', password: 'password', role: 'organizer' });
      const loginOrg = await request(app)
        .post('/login')
        .send({ email: 'org@test.com', password: 'password' });
      organizerToken = loginOrg.body.token;

      // Create an event
      const makeEvent = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: 'Big Event', description: 'Fun event', date: '2026-08-09', time: '10:00' });
      eventId = makeEvent.body.event.id;

      // Register/Login Attendee
      const regAtt = await request(app)
        .post('/register')
        .send({ name: 'Bob Attendee', email: 'bob@test.com', password: 'password', role: 'attendee' });
      attendeeId = regAtt.body.user.id;

      const loginAtt = await request(app)
        .post('/login')
        .send({ email: 'bob@test.com', password: 'password' });
      attendeeToken = loginAtt.body.token;
    });

    it('should allow attendee to register for an event successfully', async () => {
      const response = await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Successfully registered');
      expect(response.body.event.participants.length).toBe(1);
      expect(response.body.event.participants[0].userId).toBe(attendeeId);
      expect(response.body.event.participants[0].name).toBe('Bob Attendee');
    });

    it('should prevent attendee from registering twice for the same event', async () => {
      // First registration
      await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      // Second registration attempt
      const response = await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already registered');
    });

    it('should reject registration if the event does not exist', async () => {
      const response = await request(app)
        .post('/events/nonexistent-event-id/register')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(404);
    });

    it('should prevent an organizer from registering for an event', async () => {
      const response = await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(403);
    });

    it('should allow attendees to retrieve their list of registrations', async () => {
      // Register for the event
      await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      const response = await request(app)
        .get('/events/my-registrations')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.registrations.length).toBe(1);
      expect(response.body.registrations[0].id).toBe(eventId);
    });
  });
});
