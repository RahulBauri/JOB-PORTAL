import { AuthenticatedRequest } from '../middlewares/auth.js';
import { TryCath } from '../utils/TryCatch.js';

export const myProfile = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    res.json(user);
  },
);
