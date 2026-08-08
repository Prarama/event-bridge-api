/**
 * Simulated Email Service using Promises and async/await
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a welcome email when a user registers on the platform.
 * @param {string} userEmail 
 * @param {string} userName 
 */
const sendRegistrationEmail = async (userEmail, userName) => {
  const simulationDelay = parseInt(process.env.EMAIL_SIMULATION_DELAY || '500', 10);
  await delay(simulationDelay);
  console.log(`\n--- [EMAIL SERVICE: Platform Registration] ---`);
  console.log(`To: ${userName} <${userEmail}>`);
  console.log(`Subject: Welcome to EventBridge!`);
  console.log(`Body: Hi ${userName},\n\nThank you for registering on EventBridge! Your account is now active. You can now browse events or create your own depending on your role.\n`);
  console.log(`---------------------------------------------\n`);
  return true;
};

/**
 * Sends a confirmation email when a user registers for an event.
 * @param {string} userEmail 
 * @param {string} userName 
 * @param {string} eventTitle 
 * @param {string} eventDate 
 * @param {string} eventTime 
 */
const sendEventRegistrationEmail = async (userEmail, userName, eventTitle, eventDate, eventTime) => {
  const simulationDelay = parseInt(process.env.EMAIL_SIMULATION_DELAY || '500', 10);
  await delay(simulationDelay);
  console.log(`\n--- [EMAIL SERVICE: Event Registration] ---`);
  console.log(`To: ${userName} <${userEmail}>`);
  console.log(`Subject: Registration Confirmed: ${eventTitle}`);
  console.log(`Body: Hi ${userName},\n\nYou have successfully registered for "${eventTitle}" scheduled on ${eventDate} at ${eventTime}. Enjoy the event!\n`);
  console.log(`-------------------------------------------\n`);
  return true;
};

module.exports = {
  sendRegistrationEmail,
  sendEventRegistrationEmail,
};
