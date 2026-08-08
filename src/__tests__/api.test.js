const request = require('supertest');
const app = require('../app');
const { users, events, usersByEmail, usersById, eventsById, emailsInRegistration } = require('../data/store');

// Mock email simulation delay so test runs fast
process.env.EMAIL_SIMULATION_DELAY = '0';

describe('EventBridge Platform API Integration Tests', () => {
  
  // Clear the in-memory database store and indexes before each test for state isolation
  beforeEach(() => {
    users.length = 0;
    events.length = 0;
    for (const key in usersByEmail) delete usersByEmail[key];
    for (const key in usersById) delete usersById[key];
    for (const key in eventsById) delete eventsById[key];
    emailsInRegistration.clear();
  });

  describe('User Registration Validation & Mutex Concurrency (POST /register)', () => {
    const validUser = {
      name: 'John Doe',
      email: 'john@test.com',
      password: 'password123',
      role: 'attendee',
    };

    it('should reject registration if email is invalid format', async () => {
      const invalidEmailUser = { ...validUser, email: 'not-an-email' };
      const response = await request(app).post('/register').send(invalidEmailUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should reject registration if password is too short (< 6 characters)', async () => {
      const weakPasswordUser = { ...validUser, password: '123' };
      const response = await request(app).post('/register').send(weakPasswordUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 6 characters');
    });

    it('should prevent concurrent registration requests for the same email', async () => {
      const signupData = {
        name: 'Race Candidate',
        email: 'race@test.com',
        password: 'password123',
        role: 'attendee',
      };

      // Trigger two requests concurrently
      const [res1, res2] = await Promise.all([
        request(app).post('/register').send(signupData),
        request(app).post('/register').send(signupData),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);
      expect(statuses).toContain(409); // One fails with 409 Conflict
    });
  });

  describe('User Authentication & Profiles (POST /register & POST /login)', () => {
    const validOrganizer = {
      name: 'John Organizer',
      email: 'organizer@test.com',
      password: 'password123',
      role: 'organizer',
    };

    it('should register a new organizer successfully and update index maps', async () => {
      const response = await request(app)
        .post('/register')
        .send(validOrganizer);

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('organizer');
      
      const createdId = response.body.user.id;
      // Ensure it was added to index maps
      expect(usersByEmail['organizer@test.com']).toBeDefined();
      expect(usersById[createdId]).toBeDefined();
    });

    it('should log in successfully and use index lookups', async () => {
      await request(app).post('/register').send(validOrganizer);

      const response = await request(app)
        .post('/login')
        .send({
          email: validOrganizer.email,
          password: validOrganizer.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
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

    it('should allow organizer to create an event with valid capacity in the future', async () => {
      const eventDetails = {
        title: 'Virtual Tech Conference',
        description: 'A grand virtual conference on emerging technologies.',
        date: '2028-12-15',
        time: '10:00 AM',
        capacity: 100,
      };

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(eventDetails);

      expect(response.status).toBe(201);
      expect(response.body.event.capacity).toBe(100);
      expect(eventsById[response.body.event.id]).toBeDefined();
    });

    it('should reject event creation if the date is in the past', async () => {
      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Past Event',
          description: 'This is in the past',
          date: '2020-01-01',
          time: '10:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be in the future');
    });

    it('should fetch all events successfully', async () => {
      const evt1 = { id: '1', title: 'Event 1', description: 'Desc 1', date: '2028-08-01', time: '10:00', organizerId: 'org1', participants: [] };
      const evt2 = { id: '2', title: 'Event 2', description: 'Desc 2', date: '2028-08-02', time: '11:00', organizerId: 'org2', participants: [] };
      events.push(evt1, evt2);
      eventsById['1'] = evt1;
      eventsById['2'] = evt2;

      const response = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(200);
      expect(response.body.events.length).toBe(2);
    });

    it('should block updates if empty strings are sent for required parameters', async () => {
      const evt = { id: 'evt1', title: 'Title', description: 'Desc', date: '2028-08-08', time: '12:00', organizerId: organizerId, participants: [] };
      events.push(evt);
      eventsById['evt1'] = evt;

      const response = await request(app)
        .put('/events/evt1')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: '   ', date: '2028-09-09' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('cannot be empty');
    });

    it('should allow owner to delete event and clean index map', async () => {
      const evt = { id: 'evt1', title: 'Delete Me', description: 'Desc', date: '2028-08-08', time: '12:00', organizerId: organizerId, participants: [] };
      events.push(evt);
      eventsById['evt1'] = evt;

      const response = await request(app)
        .delete('/events/evt1')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(response.status).toBe(200);
      expect(events.length).toBe(0);
      expect(eventsById['evt1']).toBeUndefined();
    });
  });

  describe('Attendee Event Registration & Capacity Limits', () => {
    let attendeeToken;
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

      // Register/Login Attendee 1
      await request(app)
        .post('/register')
        .send({ name: 'Bob Attendee', email: 'bob@test.com', password: 'password', role: 'attendee' });
      const loginAtt = await request(app)
        .post('/login')
        .send({ email: 'bob@test.com', password: 'password' });
      attendeeToken = loginAtt.body.token;
    });

    it('should restrict registration when event capacity is reached', async () => {
      // Create event with capacity 1
      const makeEvent = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: 'Exclusive Meetup', description: 'Small group', date: '2028-08-09', time: '10:00', capacity: 1 });
      eventId = makeEvent.body.event.id;

      // First user registers successfully
      const reg1 = await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${attendeeToken}`);
      expect(reg1.status).toBe(200);

      // Register/Login Attendee 2
      await request(app)
        .post('/register')
        .send({ name: 'Charlie Attendee', email: 'charlie@test.com', password: 'password', role: 'attendee' });
      const loginAtt2 = await request(app)
        .post('/login')
        .send({ email: 'charlie@test.com', password: 'password' });
      const attendeeToken2 = loginAtt2.body.token;

      // Second user registration should fail
      const reg2 = await request(app)
        .post(`/events/${eventId}/register`)
        .set('Authorization', `Bearer ${attendeeToken2}`);
      expect(reg2.status).toBe(400);
      expect(reg2.body.error).toContain('capacity is full');
    });

    it('should reject registration if the event date has already passed', async () => {
      // Set up past event directly in store (avoiding creation date block)
      const pastEvent = {
        id: 'past1',
        title: 'Past Event',
        description: 'Old session',
        date: '2020-01-01',
        time: '12:00',
        organizerId: 'some-org',
        participants: [],
        capacity: null,
      };
      events.push(pastEvent);
      eventsById['past1'] = pastEvent;

      const response = await request(app)
        .post('/events/past1/register')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already occurred');
    });
  });
});
