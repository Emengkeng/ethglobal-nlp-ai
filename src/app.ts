import express from 'express';
import chatRoutes from './routes/chat.routes';

const app = express();
app.use(express.json());
app.use('/api', chatRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));