import express from 'express';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';
import jobRoutes from './routes/job.js';
import { connectKafka } from './producer.js';

const app = express();

app.use(express.json());

connectKafka();

app.use('/api/job', jobRoutes);

app.use((req, res) =>
  res.status(404).json({ message: 'route does not exists!' }),
);
app.use(errorHandlerMiddleware);

export default app;
