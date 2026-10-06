import { clients } from './helpers';

afterEach(() => {
  for (const qc of clients.splice(0)) qc.clear();
});
