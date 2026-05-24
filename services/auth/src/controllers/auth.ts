import { sql } from '../utils/db.js';
import ErrorHandler from '../utils/errorHandler.js';
import { TryCath } from '../utils/TryCatch.js';
import bcrypt from 'bcrypt';

export const registerUser = TryCath(async (req, res, next) => {
  const { name, email, password, phoneNumber, role, bio } = req.body;

  if (!name || !email || !password || !phoneNumber || !role) {
    return next(new ErrorHandler(400, 'Please fill all the details'));
  }

  const existingUser = await sql`
    SELECT user_id FROM users 
    WHERE email = ${email}
  `;

  if (existingUser.length > 0) {
    return next(new ErrorHandler(409, 'User with this email already exists'));
  }

  const hashPassword = await bcrypt.hash(password, 10);

  let registeredUser;

  if (role === 'recruiter') {
    const [user] = await sql`
      INSERT INTO users (name,email,password,phone_number, role) 
      VALUES (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}) 
      RETURNING user_id, name, email, phone_number, role, created_at
    `;

    registeredUser = user;
  } else if (role === 'jobseeker') {
    // const file =
    const [user] = await sql`
      INSERT INTO users (name,email,password,phone_number, role) 
      VALUES (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}) 
      RETURNING user_id, name, email, phone_number, role, created_at
    `;
  }
});
