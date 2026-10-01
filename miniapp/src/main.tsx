import { createRoot } from 'react-dom/client';
import '@bwnd/bbot/face.css';
import './styles.css';
import { App } from './app.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Missing app root');
createRoot(root).render(<App />);
