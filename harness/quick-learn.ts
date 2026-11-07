import { QuickLearnController } from '@/features/quick-learn/quick-learn-controller';

const status = document.querySelector<HTMLElement>('#status');
const controller = new QuickLearnController(document, (request) => {
  if (status) status.textContent = `Opened: ${request.videoTitle}`;
  return Promise.resolve();
});

controller.start();
window.addEventListener('beforeunload', () => controller.dispose(), { once: true });
