# EventBridge API

An in-memory backend system for a Virtual Event Management platform built with Node.js and Express.js. It features secure user authentication (bcrypt + JWT), role-based access control (RBAC) separating Organizers and Attendees, event CRUD management, participant event registration, and simulated asynchronous email notifications using Promises.

---

## Features

- **Secure Authentication**: User registration and login utilizing `bcryptjs` for password hashing and JWT (JSON Web Tokens) for session management.
- **Role-Based Access Control (RBAC)**:
  - **Organizers**: Can create, update, and delete events.
  - **Attendees**: Can view events, register for events, and fetch their personal event registrations.
- **In-Memory Storage**: Stores user profiles, event details, and participant lists in-memory.
- **Asynchronous Email Alerts**: Employs async/await and Promises to simulate sending email notifications upon platform signup and event registration.
- **Integration Tests**: Fully tested endpoint behavior using Jest and Supertest.

---

## Installation & Setup

1. **Clone the Repository and Navigate to Directory**:
   ```bash
   cd event-bridge-api
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (based on `.env.example`):
   ```env
   PORT=3000
   JWT_SECRET=your_jwt_secret_here
   EMAIL_SIMULATION_DELAY=500
   ```

---

## Running the Application

- **Development Mode** (auto-reloading with nodemon):
  ```bash
  npm run dev
  ```
- **Production/Standard Mode**:
  ```bash
  npm start
  ```

Once started, the API will be accessible at `http://localhost:3000`.

---

## API Endpoints

### Authentication (Public)
| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Registers a new user (role: `organizer` or `attendee`) | `{ name, email, password, role }` |
| `POST` | `/login` | Authenticates credentials and returns a JWT token | `{ email, password }` |

### Event Management (Requires JWT Bearer Token)
| Method | Endpoint | Access Role | Description | Request Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/events` | All | Fetch all events | None |
| `GET` | `/events/:id` | All | Fetch single event details by ID | None |
| `GET` | `/events/my-registrations` | All | Retrieve all events current user registered for | None |
| `POST` | `/events` | `organizer` | Create a new event | `{ title, description, date, time }` |
| `PUT` | `/events/:id` | `organizer` (Owner) | Update event details | `{ title, description, date, time }` (optional fields) |
| `DELETE` | `/events/:id` | `organizer` (Owner) | Delete an event | None |
| `POST` | `/events/:id/register` | `attendee` | Register user for an event | None |

---

## Running Tests

Verify endpoint logic and security policies using the Jest test suite:
```bash
npm test
```
