import express from 'express';
import authRoutes from './routes/auth.js';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';
import { connectKafka } from './producer.js';

const app = express();
app.use(express.json());

connectKafka();

app.use('/api/auth', authRoutes);

app.use((req, res) =>
  res.status(404).json({ message: 'route does not exists!' }),
);
app.use(errorHandlerMiddleware);

export default app;
