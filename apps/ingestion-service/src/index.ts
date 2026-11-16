import { createApp } from './server';

const PORT = Number(process.env.PORT ?? 3200);

const app = createApp();

app.listen(PORT, () => {
  console.log(`ingestion-service running on port ${PORT}`);
});
