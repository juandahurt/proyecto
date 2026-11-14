import { createApp } from './server';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3100;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Identity service listening on port ${PORT}`);
});
