import { createApp } from './server';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3400;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Progress service listening on port ${PORT}`);
});
