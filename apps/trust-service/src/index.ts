import { createApp } from './server';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3300;

const app = createApp();

app.listen(PORT, () => {
  console.log(`trust-service listening on port ${PORT}`);
});
