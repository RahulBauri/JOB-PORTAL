import axios from 'axios';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import getBuffer from '../utils/buffer.js';
import { sql } from '../utils/db.js';
import ErrorHandler from '../utils/errorHandler.js';
import { TryCath } from '../utils/TryCatch.js';

export const myProfile = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    res.json(user);
  },
);

export const getUserProfile = TryCath(async (req, res, next) => {
  const { userId } = req.params;

  const users = await sql`
        SELECT u.user_id, u.name, u.email, u.phone_number, u.role, u.bio, u.resume, u.resume_public_id, u.profile_pic, u.profile_pic_public_id, u.subscription, 
        ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) as user_skills
        FROM users u 
        LEFT JOIN user_skills us ON u.user_id = us.user_id
        LEFT JOIN skills s ON us.skill_id = s.skill_id
        WHERE u.user_id = ${userId}
        GROUP BY u.user_id
      `;

  if (users.length === 0) {
    return next(new ErrorHandler(404, 'user not found'));
  }

  const user = users[0];
  user.skills = user.skills || [];

  res.json(user);
});

export const updateUserProfile = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    const { name, phoneNumber, bio } = req.body;

    const newName = name || user?.name;
    const newPhoneNumber = phoneNumber || user?.phone_number;
    const newBio = bio || user?.bio;

    const [updatedUser] = await sql`
      UPDATE users SET name = ${newName}, phone_number = ${newPhoneNumber}, bio = ${newBio}
      WHERE user_id = ${user?.user_id}  
      RETURNING user_id, name, email, phone_number, bio 
    `;

    res.json({ message: 'Profile updated successfully', updatedUser });
  },
);

export const updateProfilePic = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    const file = req.file;

    if (!file) {
      return next(new ErrorHandler(400, 'No image file provided'));
    }

    const oldPublicId = user?.profile_pic_public_id;

    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      return next(new ErrorHandler(500, 'Failed to generate buffer'));
    }

    const { data: uploadResult } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      {
        buffer: fileBuffer.content,
        public_id: oldPublicId,
      },
    );

    const [updatedUser] = await sql`
      UPDATE users SET profile_pic = ${uploadResult.url}, profile_pic_public_id = ${uploadResult.public_id}
      WHERE user_id = ${user?.user_id}
      RETURNING user_id, name, profile_pic
    `;

    res.json({ message: 'Profile pic updated', updatedUser });
  },
);

export const updateResume = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    const file = req.file;

    if (!file) {
      return next(new ErrorHandler(400, 'No pdf file provided'));
    }

    const oldPublicId = user?.resume_public_id;

    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      return next(new ErrorHandler(500, 'Failed to generate buffer'));
    }

    const { data: uploadResult } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      {
        buffer: fileBuffer.content,
        public_id: oldPublicId,
      },
    );

    const [updatedUser] = await sql`
      UPDATE users SET resume = ${uploadResult.url}, resume_public_id = ${uploadResult.public_id}
      WHERE user_id = ${user?.user_id}
      RETURNING user_id, name, resume
    `;

    res.json({ message: 'Resume updated', updatedUser });
  },
);
