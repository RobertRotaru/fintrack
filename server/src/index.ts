import { createApp } from './app';
import { startRateUpdates } from './fx';

const port = Number(process.env.PORT ?? 4000);
startRateUpdates();
createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`));
