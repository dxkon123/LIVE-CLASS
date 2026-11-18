// Which page is open?
// /?view=stage  -> the page for TikTok LIVE Studio (1080x1920), the ONLY page that plays sound
// /             -> control page, silent, open as many tabs as you like
import { STANDALONE } from './env';
import { api } from './api';
const params = new URLSearchParams(window.location.search);
// single-file build: one page runs the game AND plays the sound
export const IS_STAGE = STANDALONE || params.get('view') === 'stage';
// this stage page's own id: the server only lets the most recently opened stage page play sound
export const STAGE_ID = IS_STAGE ? Math.random().toString(36).slice(2, 10) : '';

// Design size of the stage. Everything is drawn in a 1080x1920 frame and scaled to fit.
export const STAGE_W = 1080;
export const STAGE_H = 1920;

// Send a command from the control page to the stage page
export async function sendControl(action: string, text?: string) {
  const r = await api('/api/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, text }),
  });
  return r.json();
}

// Simulated events for testing before going live
export async function emitTest(type: string, data: Record<string, unknown>) {
  await api('/api/test/emit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data }),
  });
}
