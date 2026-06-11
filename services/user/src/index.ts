import express from 'express';
import dotenv from 'dotenv';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';
import userRoutes from './routes/user.js';

dotenv.config();

const app = express();

app.use(express.json());

app.use('/api/user', userRoutes);

app.use((req, res) =>
  res.status(404).json({ message: 'route does not exists!' }),
);
app.use(errorHandlerMiddleware);

app.listen(process.env.PORT, () => {
  console.log(
    `User service is running on http://localhost:${process.env.PORT}`,
  );
});
