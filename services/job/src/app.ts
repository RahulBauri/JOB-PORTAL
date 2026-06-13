import express from 'express';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';

const app = express();

app.use(express.json());

app.use((req, res) =>
  res.status(404).json({ message: 'route does not exists!' }),
);
app.use(errorHandlerMiddleware);

export default app;
